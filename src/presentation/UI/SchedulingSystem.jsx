import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { getScheduleResult, solveSchedule, waitForSolveResult, evaluateMove, saveSession } from "../../services/scheduleService";
import SectionPicker from "./SectionPicker";
import SolverProgress from "./SolverProgress";
import ConflictPanel from "./ConflictPanel";

const DAYS = ["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
const PERIODS = [
  {id:1,name:"Tiết 1",time:"07:00-07:50"},{id:2,name:"Tiết 2",time:"08:00-08:50"},
  {id:3,name:"Tiết 3",time:"09:00-09:50"},{id:4,name:"Tiết 4",time:"10:00-10:50"},
  {id:5,name:"Tiết 5",time:"11:00-11:50"},{id:"break",name:"Nghỉ trưa",time:"12:00-12:50"},
  {id:6,name:"Tiết 6",time:"13:00-13:50"},{id:7,name:"Tiết 7",time:"14:00-14:50"},
  {id:8,name:"Tiết 8",time:"15:00-15:50"},{id:9,name:"Tiết 9",time:"16:00-16:50"},
  {id:10,name:"Tiết 10",time:"17:00-17:50"},{id:11,name:"Tiết 11",time:"18:00-18:50"},
  {id:12,name:"Tiết 12",time:"19:00-19:50"},
];
const KNOWN_MAJORS = ["BCSE","MJM","EFTH","ESAS","ECE","GEN"];

const getTimePart = (v) => {
  if (!v) return "";
  const raw = String(v);
  const t = raw.includes("T") ? raw.split("T")[1] : raw;
  const [h,m] = t.split(":");
  if (h===undefined||m===undefined) return "";
  return `${String(h).padStart(2,"0")}:${m}`;
};
const toMinutes = (v) => { const [h,m]=String(v||"00:00").split(":"); return Number(h)*60+Number(m); };
const getPeriodIdFromTime = (startTime) => {
  const time = getTimePart(startTime);
  const match = PERIODS.find(p=>p.id!=="break"&&p.time.startsWith(time));
  if (match) return match.id;
  const minutes = toMinutes(time);
  let closest=1,minDiff=Infinity;
  PERIODS.forEach(p=>{ if(p.id==="break") return; const diff=Math.abs(toMinutes(p.time.split("-")[0])-minutes); if(diff<minDiff){minDiff=diff;closest=p.id;} });
  return closest;
};
const mapDayIndex = (d) => { const v=Number(d); if(Number.isNaN(v)) return null; if(v>=2&&v<=7) return v-2; if(v>=1&&v<=6) return v-1; return null; };
const inferMajor = (subjectName,groupName) => { const h=`${subjectName||""} ${groupName||""}`.toUpperCase(); for(const m of KNOWN_MAJORS){if(h.includes(m)) return m;} return "GEN"; };
const mapReqRoom = (rt,dm) => { if(dm===1) return "Online"; return rt===1?"Lab":"Theory"; };

const buildLessonsFromSchedule = (schedule) => {
  const tMap = new Map((schedule.teachers||[]).map(t=>[t.id,t]));
  const courseMap = new Map((schedule.courses||[]).map(c=>[c.id,c]));
  const sectionMap = new Map((schedule.courseSections||[]).map(cs=>[cs.id,cs]));
  // fallback for old subjects field
  const sMap = new Map((schedule.subjects||[]).map(s=>[s.id,s]));
  const gMap = new Map((schedule.studentGroups||[]).map(g=>[g.id,g]));
  const tsMap = new Map((schedule.timeSlots||[]).map(t=>[t.id,t]));

  return (schedule.lessons||[]).map(lesson=>{
    const section = sectionMap.get(lesson.courseSectionId);
    const course = section ? courseMap.get(section.courseId) : null;
    const subject = sMap.get(lesson.subjectId);
    
    // Linh hoạt lấy tên giảng viên: từ teacherNames array hoặc sectionTeachers object list
    let teachers = [];
    if (section) {
      if (Array.isArray(section.teacherNames)) {
        teachers = section.teacherNames;
      } else if (Array.isArray(section.sectionTeachers)) {
        teachers = section.sectionTeachers.map(st => tMap.get(st.teacherId)?.name).filter(Boolean);
      }
    }
    
    const group = gMap.get(lesson.studentGroupId);
    // Linh hoạt lấy tên nhóm SV: Ưu tiên studentGroupNames (array string), sau đó là lookup từ studentGroupIds
    const groupName = section?.studentGroupNames?.join(", ") 
      || (section?.studentGroupIds || []).map(gid => gMap.get(gid)?.name).filter(Boolean).join(", ")
      || group?.name 
      || "N/A";

    const ts = tsMap.get(lesson.timeSlotId);
    let slotId = null;
    if (ts && lesson.timeSlotId!=null) {
      const di = mapDayIndex(ts.dayOfWeek);
      const pi = getPeriodIdFromTime(ts.startTime);
      slotId = di!==null&&pi ? `${di}-${pi}` : null;
    }

    const name = section?.courseName || course?.name || subject?.name || `Môn ${lesson.subjectId}`;
    const teacherStr = teachers.length > 0 ? teachers.join(", ") : (tMap.get(lesson.teacherId)?.name || `GV ${lesson.teacherId}`);
    
    const duration = lesson.sessionDuration || 1;
    return {
      id: String(lesson.id),
      name,
      section: section?.sectionCode || "HP1",
      isRequired: (section && course?.courseType===0) ?? true,
      teacher: teacherStr,
      type: /GS|PGS/i.test(teacherStr) ? "Guest" : "Resident",
      reqRoom: mapReqRoom(lesson.requiredRoomType??course?.requiredRoomType, lesson.deliveryMode),
      cap: group?.size ?? 0,
      duration,
      sessionDuration: duration,
      isPinned: lesson.isPinned ?? false,
      major: inferMajor(name, groupName),
      courseSectionId: lesson.courseSectionId,
      slotId,
    };
  });
};

export default function SchedulingSystem() {
  const [scenarioId, setScenarioId] = useState("");
  const [scheduleRaw, setScheduleRaw] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [isSolving, setIsSolving] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [solveMessage, setSolveMessage] = useState(null);
  const [apiScore, setApiScore] = useState({hard:0,soft:0});
  const [selectedMajor, setSelectedMajor] = useState("ALL");
  const [scheduleState, setScheduleState] = useState("empty");
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [evalPopup, setEvalPopup] = useState(null);
  const pendingDropRef = useRef(null);

  const majors = useMemo(()=>{
    const s=new Set(lessons.map(l=>l.major).filter(Boolean));
    return ["ALL",...Array.from(s)];
  },[lessons]);

  useEffect(()=>{ if(!majors.includes(selectedMajor)) setSelectedMajor("ALL"); },[majors,selectedMajor]);

  const filteredLessons = useMemo(()=>selectedMajor==="ALL"?lessons:lessons.filter(l=>l.major===selectedMajor),[lessons,selectedMajor]);
  const unassignedLessons = filteredLessons.filter(l=>!l.slotId);
  const allPlaced = lessons.filter(l=>l.slotId);
  const allUnassigned = lessons.filter(l=>!l.slotId);
  const placedLessons = filteredLessons.filter(l=>l.slotId);

  const cellMap = useMemo(()=>{ const m={}; placedLessons.forEach(l=>{ if(!l.slotId) return; if(!m[l.slotId]) m[l.slotId]=[]; m[l.slotId].push(l); }); return m; },[placedLessons]);

  // Drag & Drop
  const onDragStart = useCallback((e,id)=>{ setDragId(id); e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",id); },[]);
  const onDragEnd = useCallback(()=>{ setDragId(null); setDragOver(null); },[]);
  const onCellDragOver = useCallback((e,sk)=>{ e.preventDefault(); e.dataTransfer.dropEffect="move"; setDragOver(sk); },[]);
  const onCellDragLeave = useCallback(()=>setDragOver(null),[]);

  const onCellDrop = useCallback(async(e,slotKey)=>{
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain")||dragId;
    if(!id) return;
    setDragId(null); setDragOver(null);

    // Parse slotKey → periodId → timeSlotId
    const [di,pi] = slotKey.split("-").map(Number);
    const period = PERIODS.find(p=>p.id===pi);

    if(sessionId && period) {
      // Find lesson to get its current data
      const lesson = lessons.find(l=>l.id===id);
      // Find matching timeSlot in scheduleRaw
      const ts = (scheduleRaw?.timeSlots||[]).find(t=>{
        const tdi = mapDayIndex(t.dayOfWeek);
        const tpi = getPeriodIdFromTime(t.startTime);
        return tdi===di && tpi===pi;
      });
      if(ts) {
        pendingDropRef.current = {id, slotKey, timeSlotId: ts.id};
        try {
          const evalRes = await evaluateMove(sessionId,[{lessonId:Number(id),newTimeSlotId:ts.id,newRoomId:null}]);
          setEvalPopup({...evalRes, pendingId:id, pendingSlot:slotKey});
          return;
        } catch(_) { /* fall through to direct move */ }
      }
    }
    // Direct move without evaluation
    setLessons(prev=>prev.map(l=>l.id===id?{...l,slotId:slotKey}:l));
    if(scheduleState==="loaded"||scheduleState==="solved") setScheduleState("manual");
  },[dragId,sessionId,lessons,scheduleRaw,scheduleState]);

  const onPanelDrop = useCallback((e)=>{ e.preventDefault(); const id=e.dataTransfer.getData("text/plain")||dragId; if(!id) return; setLessons(prev=>prev.map(l=>l.id===id?{...l,slotId:null}:l)); setDragId(null); setDragOver(null); },[dragId]);
  const onPanelDragOver = useCallback((e)=>{ e.preventDefault(); e.dataTransfer.dropEffect="move"; setDragOver("panel"); },[]);

  /* ─── API handlers ─── */
  const handleLoad = async () => {
    const tid = scenarioId.trim();
    if (!tid) { setDataMessage({ type: "error", text: "Vui lòng nhập Scenario ID." }); return; }
    setIsLoadingData(true); setDataMessage(null); setSolveMessage(null);
    try {
      const result = await getScheduleResult(tid);
      const schedule = result?.schedule || result;
      if (!schedule?.lessons) throw new Error("API không trả về dữ liệu hợp lệ.");
      setScheduleRaw(schedule);
      setLessons(buildLessonsFromSchedule(schedule, false));
      setApiScore({ hard: 0, soft: 0 });
      setScenarioId(result?.scenarioId || tid);
      setScheduleState("loaded");
      setDataMessage({ type: "success", text: `Đã tải ${schedule.lessons.length} lớp. Kéo thả hoặc nhấn "Xếp lịch tự động".` });
    } catch (err) {
      setDataMessage({ type: "error", text: `Lỗi: ${err.message}` });
    } finally { setIsLoadingData(false); }
  };

  const handleLoadMock = () => {
    const payload = mockSchedule?.schedule ? mockSchedule : { schedule: mockSchedule };
    const schedule = payload.schedule || payload;
    if (!schedule?.lessons) {
      setDataMessage({ type: "error", text: "Mock khong hop le." });
      return;
    }
    
    setScheduleRaw(schedule);
    setLessons(buildLessonsFromSchedule(schedule));
    setConflicts(schedule.conflicts||[]);
    
    // Lấy điểm số từ solveData hoặc schedule
    const hs = solveData.hardScore ?? schedule.hardScore ?? 0;
    const ss = solveData.softScore ?? schedule.softScore ?? 0;
    setApiScore({ hard: hs, soft: ss });
    setScheduleState("solved");
    setSolveMessage(null);
    setDataMessage({ type: "success", text: "Da nap mock de test nhanh." });
  };

  const handleSolve = async () => {
    if (!scheduleRaw) { setSolveMessage({ type: "error", text: "Chưa có dữ liệu." }); return; }
    const tid = scenarioId.trim() || `scenario-${Date.now()}`;
    setIsSolving(true); setSolveMessage({ type: "info", text: "Đang gửi yêu cầu..." });
    try {
      const result = await solveSchedule({ scenarioId: tid, schedule: scheduleRaw, saveScenario: true, saveResult: true });
      const schedule = result?.schedule || result;
      if (!schedule?.lessons) throw new Error("API không trả về kết quả hợp lệ.");
      setLessons(buildLessonsFromSchedule(schedule, true));
      setScheduleRaw(schedule);
      setApiScore({ hard: schedule.hardScore ?? 0, soft: schedule.softScore ?? 0 });
      if (result?.scenarioId) setScenarioId(result.scenarioId);
      setScheduleState("solved");
      setSolveMessage({ type: schedule.hardScore === 0 ? "success" : "warning", text: `Xếp xong! Hard: ${schedule.hardScore ?? 0}, Soft: ${schedule.softScore ?? 0}` });
    } catch (err) {
      setSolveMessage({ type: "error", text: `Lỗi: ${err.message}` });
    } finally { setIsSolving(false); }
  };

  const handleReset = () => {
    setLessons([]); setScheduleRaw(null); setSessionId(null); setJobId(null);
    setConflicts([]); setHighlightedIds(new Set()); setScheduleState("empty");
    setSolveMessage(null); setSaveMessage(null); setApiScore({hard:0,soft:0});
  };

  const handleEvalConfirm = () => {
    if(!evalPopup) return;
    const {pendingId,pendingSlot} = evalPopup;
    setLessons(prev=>prev.map(l=>l.id===pendingId?{...l,slotId:pendingSlot}:l));
    if(scheduleState==="solved") setScheduleState("manual");
    setEvalPopup(null);
  };

  const getGridRowStart = (pid) => { if(pid==="break") return 7; const p=Number(pid); return p<=5?p+1:p+2; };

  const stateMap = {
    empty: { text: "Chưa có dữ liệu", cls: "state-empty", icon: "📭" },
    loaded: { text: "Đã tải – Chờ xếp lịch", cls: "state-loaded", icon: "⏳" },
    manual: { text: "Đang xếp tay", cls: "state-manual", icon: "✋" },
    solved: { text: "Đã xếp xong", cls: "state-solved", icon: "✅" },
  };
  const st = stateMap[scheduleState]||stateMap.empty;

  const LessonCard = ({lesson,variant="grid"}) => {
    const cardRef = useRef(null);
    const [flipLeft,setFlipLeft] = useState(false);
    const isHighlighted = highlightedIds.has(lesson.id);
    return (
      <div
        ref={cardRef}
        className={`lesson-card ${variant} ${lesson.major} ${dragId === lesson.id ? "dragging" : ""}`}
        draggable
        onDragStart={(e) => onDragStart(e, lesson.id)}
        onDragEnd={onDragEnd}
        onMouseEnter={handleMouseEnter}
      >
        <div className="lesson-head">
          <span className="lesson-major">{lesson.major}</span>
          <span className="lesson-section">{lesson.section}</span>
          {variant === "grid" && <span className="lesson-remove" title="Gỡ khỏi lịch" onClick={() => setLessons((p) => p.map((l) => l.id === lesson.id ? { ...l, slotId: null } : l))}>✕</span>}
        </div>
        <strong>{lesson.name}</strong>
        <span className="lesson-teacher">{lesson.teacher}</span>
        <div className="lesson-meta">
          <span className="meta-room">{lesson.reqRoom}</span>
          <span className="meta-cap">{lesson.cap} SV</span>
          {lesson.duration>1&&<span className="meta-dur">⏱{lesson.duration}t</span>}
        </div>
        <div className={`lesson-tooltip ${flipLeft?"flip-left":""}`}>
          <div className="tt-row-top">
            <span className="tt-major">{lesson.major}</span>
            <span className="tt-section">Học Phần {lesson.section}</span>
            <span className={`tt-req-badge ${lesson.isRequired ? "required" : "elective"}`}>
              {lesson.isRequired ? "BẮT BUỘC" : "TỰ CHỌN"}
            </span>
          </div>
          <div className="tt-name">{lesson.name}</div>
          <div className="tt-teacher-row">
            <span className="tt-label">{t.ttTeacher}</span>
            <strong>{lesson.teacher}</strong>{" "}
            <span className={`tt-type ${lesson.type==="Guest"?"guest":""}`}>({lesson.type})</span>
          </div>
          <div className="tt-details">
            <div className="tt-detail-col">
              <span className="tt-label">Thời lượng:</span>
              <span className="tt-val">⏱ {lesson.duration || 1} Tiết</span>
            </div>
            <div className="tt-detail-col">
              <span className="tt-label">Sĩ số (SV):</span>
              <span className="tt-val">👥 {lesson.cap} Sinh viên</span>
            </div>
          </div>
          <div className="tt-room-row">
            <span className="tt-label">Yêu cầu phòng:</span>
            <span className="tt-val">🏢 {lesson.reqRoom}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`schedv2 ${dragId ? "is-dragging" : ""}`}>
      {/* ═══ Header ═══ */}
      <div className="schedv2-header">
        <div className="schedv2-actions">
          <input className="schedv2-input" type="text" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} placeholder="Scenario ID" />
          <button className="schedv2-btn ghost" type="button" onClick={handleLoad} disabled={isLoadingData}>
            {isLoadingData ? "Đang tải..." : "📥 Tải dữ liệu"}
          </button>
          <button className="schedv2-btn ghost" type="button" onClick={handleLoadMock}>
            Load mock
          </button>
          <button className="schedv2-btn primary" type="button" onClick={handleSolve} disabled={isSolving || !scheduleRaw} title={!scheduleRaw ? "Tải dữ liệu trước" : ""}>
            {isSolving ? <span className="btn-solving"><span className="solving-spinner" />Đang xếp...</span> : "⚡ Xếp lịch tự động"}
          </button>
          <button className="schedv2-btn ghost" type="button" onClick={handleReset}>↺ Reset</button>
        </div>
      )}

      {/* Status row */}
      <div className="schedv2-status-row">
        <span className={`schedv2-state-label ${st.cls}`}>{st.icon} {st.text}</span>
        <div className="schedv2-messages">
          {solveMessage&&<span className={`schedv2-msg ${solveMessage.type}`}>{solveMessage.text}</span>}
          {saveMessage&&<span className={`schedv2-msg ${saveMessage.type}`}>{saveMessage.text}</span>}
        </div>
        <div className="schedv2-score">
          <div className={`score-pill ${apiScore.hard<0?"warn":"ok"}`}>Hard: {apiScore.hard}</div>
          <div className="score-pill soft">Soft: {apiScore.soft}</div>
        </div>
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="schedv2-toolbar">
        <div className="schedv2-filters">
          {majors.map((m) => (
            <button key={m} type="button" className={`schedv2-filter ${selectedMajor === m ? "active" : ""}`} onClick={() => setSelectedMajor(m)}>
              {m === "ALL" ? "Toàn trường" : m}
            </button>
          ))}
        </div>
        <div className="schedv2-drag-hint">
          {scheduleState !== "empty" && <span>💡 Kéo thả lớp học để xếp lịch thủ công</span>}
        </div>
      )}

      {/* ═══ Main layout ═══ */}
      <div className="schedv2-layout">
        {/* Left panel: Pending lessons */}
        <aside className="schedv2-panel" onDragOver={onPanelDragOver} onDragLeave={onCellDragLeave} onDrop={onPanelDrop}>
          <div className="panel-header">
            <span>📋 Lớp chờ xếp {selectedMajor !== "ALL" ? `(${selectedMajor})` : ""}</span>
            <span className="panel-count">{unassignedLessons.length}</span>
          </div>
          <div className={`panel-list ${dragOver === "panel" ? "drop-target" : ""}`}>
            {unassignedLessons.length === 0 ? (
              <div className="panel-empty">
                {scheduleState === "empty" ? "Nhập Scenario ID và nhấn 'Tải dữ liệu'." : "Tất cả lớp đã được xếp. ✓"}
              </div>
            ) : (
              unassignedLessons.map((l) => <LessonCard key={l.id} lesson={l} variant="pending" />)
            )}
          </div>
        </aside>

        {/* Center grid */}
        <section className="schedv2-grid">
          <div className="schedv2-grid-head">
            Thời khóa biểu {selectedMajor !== "ALL" ? `– ${selectedMajor}` : ""}
            {scheduleState === "solved" && <span className="grid-head-solved">✓ Đã xếp</span>}
          </div>
          <div className="schedv2-grid-wrap">
            <div className="schedv2-grid-table" style={{ gridTemplateColumns: "70px repeat(6, 1fr)", gridTemplateRows: "36px repeat(5, 60px) 30px repeat(7, 60px)" }}>
              <div className="schedv2-grid-row header">
                <div className="schedv2-grid-cell time">Tiết</div>
                {DAYS.map((d, i) => <div key={d} className={`schedv2-grid-cell day ${i === 5 ? "sat" : ""}`}>{d}</div>)}
              </div>
              {PERIODS.map(period=>{
                const rowStart = getGridRowStart(period.id);
                if (period.id === "break") {
                  return <div key="break" className="schedv2-break" style={{ gridRowStart: rowStart, gridColumnStart: 1, gridColumnEnd: 8 }}>{period.time} – NGHỈ TRƯA</div>;
                }
                return (
                  <div key={period.id} className="schedv2-grid-row" style={{ gridRowStart: rowStart }}>
                    <div className="schedv2-grid-cell time"><strong>{period.name}</strong><span>{period.time}</span></div>
                    {DAYS.map((_, di) => {
                      const sk = `${di}-${period.id}`;
                      const cls = cellMap[sk] || [];
                      const isOver = dragOver === sk;
                      return (
                        <div key={sk}
                          className={`schedv2-grid-cell body ${di === 5 ? "sat" : ""} ${isOver ? "drop-target" : ""}`}
                          onDragOver={(e) => onCellDragOver(e, sk)}
                          onDragLeave={onCellDragLeave}
                          onDrop={(e) => onCellDrop(e, sk)}
                        >
                          {cls.map((l) => <LessonCard key={l.id} lesson={l} variant="grid" />)}
                          {isOver && cls.length === 0 && <div className="drop-placeholder">Thả vào đây</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right panel: Stats */}
        <aside className="schedv2-panel right">
          <div className="panel-header"><span>📊 Thống kê</span></div>
          <div className="panel-score">
            <div className={`score-box ${apiScore.hard < 0 ? "warn" : "ok"}`}><span>HARD</span><strong>{apiScore.hard}</strong></div>
            <div className="score-box soft"><span>SOFT</span><strong>{apiScore.soft}</strong></div>
          </div>
          <div className="panel-stats">
            <div className="stat-item"><span className="stat-label">Tổng số lớp</span><span className="stat-value">{lessons.length}</span></div>
            <div className="stat-item placed"><span className="stat-label">Đã xếp</span><span className="stat-value">{allPlaced.length}</span></div>
            <div className="stat-item pending"><span className="stat-label">Chờ xếp</span><span className="stat-value">{allUnassigned.length}</span></div>
          </div>
          {lessons.length > 0 && (
            <div className="panel-progress">
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${lessons.length ? (allPlaced.length / lessons.length * 100) : 0}%` }} /></div>
              <span className="progress-text">{lessons.length ? Math.round(allPlaced.length / lessons.length * 100) : 0}% hoàn thành</span>
            </div>
          )}
          <div className="panel-log">
            {isSolving ? "⏳ Đang gọi API..." : solveMessage?.text || (scheduleState !== "empty" ? "📋 Sẵn sàng. Kéo thả hoặc nhấn xếp tự động." : "Hãy tải dữ liệu để bắt đầu.")}
          </div>
        </aside>
      </div>
    </div>
  );
}
