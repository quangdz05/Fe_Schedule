import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { getScheduleResult, solveSchedule } from "../../services/scheduleService";
import mockSchedule from "../../data/mock_schedule.json";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const PERIODS = [
  { id: 1, name: "Tiết 1", time: "07:00-07:50" },
  { id: 2, name: "Tiết 2", time: "08:00-08:50" },
  { id: 3, name: "Tiết 3", time: "09:00-09:50" },
  { id: 4, name: "Tiết 4", time: "10:00-10:50" },
  { id: 5, name: "Tiết 5", time: "11:00-11:50" },
  { id: "break", name: "Nghỉ trưa", time: "12:00-12:50" },
  { id: 6, name: "Tiết 6", time: "13:00-13:50" },
  { id: 7, name: "Tiết 7", time: "14:00-14:50" },
  { id: 8, name: "Tiết 8", time: "15:00-15:50" },
  { id: 9, name: "Tiết 9", time: "16:00-16:50" },
  { id: 10, name: "Tiết 10", time: "17:00-17:50" },
  { id: 11, name: "Tiết 11", time: "18:00-18:50" },
  { id: 12, name: "Tiết 12", time: "19:00-19:50" },
];

const KNOWN_MAJORS = ["BCSE", "MJM", "EFTH", "ESAS", "ECE", "GEN"];

const getTimePart = (v) => {
  if (!v) return "";
  const raw = String(v);
  const t = raw.includes("T") ? raw.split("T")[1] : raw;
  const [h, m] = t.split(":");
  if (h === undefined || m === undefined) return "";
  return `${String(h).padStart(2, "0")}:${m}`;
};

const toMinutes = (v) => {
  const [h, m] = String(v || "00:00").split(":");
  return Number(h) * 60 + Number(m);
};

const getPeriodIdFromTime = (startTime) => {
  const time = getTimePart(startTime);
  const match = PERIODS.find((p) => p.id !== "break" && p.time.startsWith(time));
  if (match) return match.id;
  const minutes = toMinutes(time);
  let closest = 1, minDiff = Infinity;
  PERIODS.forEach((p) => {
    if (p.id === "break") return;
    const diff = Math.abs(toMinutes(p.time.split("-")[0]) - minutes);
    if (diff < minDiff) { minDiff = diff; closest = p.id; }
  });
  return closest;
};

const getDurationFromTime = (s, e) => {
  const start = toMinutes(getTimePart(s)), end = toMinutes(getTimePart(e));
  if (!start || !end || end <= start) return 1;
  return Math.max(1, Math.min(Math.round((end - start) / 50), 6));
};

const mapDayIndex = (d) => {
  const v = Number(d);
  if (Number.isNaN(v)) return null;
  if (v >= 2 && v <= 7) return v - 2;
  if (v >= 1 && v <= 6) return v - 1;
  return null;
};

const inferMajor = (subjectName, groupName) => {
  const h = `${subjectName || ""} ${groupName || ""}`.toUpperCase();
  for (const m of KNOWN_MAJORS) { if (h.includes(m)) return m; }
  return "GEN";
};

const mapReqRoom = (rt, dm) => {
  if (dm === 1) return "Online";
  return rt === 1 ? "Lab" : "Theory";
};

const buildLessonsFromSchedule = (schedule, assignSlots = true) => {
  const tMap = new Map((schedule.teachers || []).map((t) => [t.id, t]));
  const sMap = new Map((schedule.subjects || []).map((s) => [s.id, s]));
  const gMap = new Map((schedule.studentGroups || []).map((g) => [g.id, g]));
  const tsMap = new Map((schedule.timeSlots || []).map((t) => [t.id, t]));

  return (schedule.lessons || []).map((lesson) => {
    const teacher = tMap.get(lesson.teacherId);
    const subject = sMap.get(lesson.subjectId);
    const group = gMap.get(lesson.studentGroupId);
    const ts = tsMap.get(lesson.timeSlotId);
    let slotId = null;
    if (assignSlots && ts && lesson.timeSlotId != null) {
      const di = mapDayIndex(ts.dayOfWeek);
      const pi = getPeriodIdFromTime(ts.startTime);
      slotId = di !== null && pi ? `${di}-${pi}` : null;
    }
    const sn = subject?.name || "";
    const sec = sn.match(/HP\d+/i);
    const tn = teacher?.name || "";
    return {
      id: String(lesson.id),
      name: sn || `Mon ${lesson.subjectId}`,
      section: sec ? sec[0].toUpperCase() : "HP1",
      isRequired: true,
      teacher: tn || `GV ${lesson.teacherId}`,
      type: /\bGS|PGS\b/i.test(tn) ? "Guest" : "Resident",
      reqRoom: mapReqRoom(lesson.requiredRoomType ?? subject?.requiredRoomType, lesson.deliveryMode),
      cap: group?.size ?? 0,
      duration: ts ? getDurationFromTime(ts.startTime, ts.endTime) : 1,
      major: inferMajor(sn, group?.name),
      slotId,
    };
  });
};

/* ═══════════════ MAIN COMPONENT ═══════════════ */

export default function SchedulingSystem({ user, language = "Vietnamese" }) {
  const userRole = String(user?.role || "").toLowerCase();
  const readOnly = userRole === "student";
  const isVi = language === "Vietnamese";

  const t = {
    loadData: isVi ? " Tải dữ liệu" : " Load Data",
    loading: isVi ? "Đang tải..." : "Loading...",
    autoSchedule: isVi ? " Xếp lịch tự động" : " Auto-Schedule",
    loadDataFirst: isVi ? "Tải dữ liệu trước" : "Load data first",
    schedulingBtn: isVi ? "Đang xếp..." : "Scheduling...",
    allMajors: isVi ? "Toàn trường" : "All Majors",
    dragHint: isVi ? " Kéo thả lớp học để xếp lịch thủ công" : " Drag & drop classes to schedule manually",
    pendingClasses: isVi ? " Lớp chờ xếp" : " Pending Classes",
    allScheduled: isVi ? "Tất cả lớp đã được xếp. ✓" : "All classes scheduled. ✓",
    enterScenario: isVi ? "Nhập Scenario ID và nhấn 'Tải dữ liệu'." : "Enter Scenario ID and press 'Load Data'.",
    timetable: isVi ? "Thời khóa biểu" : "Timetable",
    scheduled: isVi ? "✓ Đã xếp" : "✓ Scheduled",
    period: isVi ? "Tiết" : "Period",
    dropHere: isVi ? "Thả vào đây" : "Drop here",
    stats: isVi ? " Thống kê" : " Statistics",
    totalClasses: isVi ? "Tổng số lớp" : "Total Classes",
    scheduledCount: isVi ? "Đã xếp" : "Scheduled",
    pendingCount: isVi ? "Chờ xếp" : "Pending",
    completed: isVi ? "hoàn thành" : "completed",
    callingApi: isVi ? " Đang gọi API..." : " Calling API...",
    ready: isVi ? " Sẵn sàng. Kéo thả hoặc nhấn xếp tự động." : " Ready. Drag & drop or auto-schedule.",
    loadToStart: isVi ? "Hãy tải dữ liệu để bắt đầu." : "Load data to start.",
    removeFromSchedule: isVi ? "Gỡ khỏi lịch" : "Remove from schedule",
    lunchBreak: isVi ? "NGHỈ TRƯA" : "LUNCH BREAK",
    stateEmpty: isVi ? "Chưa có dữ liệu" : "No data",
    stateLoaded: isVi ? "Đã tải – Chờ xếp lịch" : "Data loaded",
    stateManual: isVi ? "Đang xếp tay" : "Manual scheduling",
    stateSolved: isVi ? "Đã xếp xong" : "Schedule completed",
    errInvalidId: isVi ? "Vui lòng nhập Scenario ID." : "Please enter Scenario ID.",
    errInvalidData: isVi ? "API không trả về dữ liệu hợp lệ." : "API returned invalid data.",
    loadedSuccess: (count) => isVi ? `Đã tải ${count} lớp. Kéo thả hoặc nhấn "Xếp lịch tự động".` : `Loaded ${count} classes. Drag & drop or "Auto-Schedule".`,
    mockInvalid: isVi ? "Mock không hợp lệ." : "Invalid mock.",
    mockSuccess: isVi ? "Đã nạp mock để test nhanh." : "Mock data loaded for quick test.",
    errNoData: isVi ? "Chưa có dữ liệu." : "No data available.",
    sendingReq: isVi ? "Đang gửi yêu cầu..." : "Sending request...",
    solveSuccess: (hard, soft) => isVi ? `Xếp xong! Hard: ${hard}, Soft: ${soft}` : `Done! Hard: ${hard}, Soft: ${soft}`,
    errPrefix: isVi ? "Lỗi: " : "Error: ",
    ttSection: isVi ? "Học Phần" : "Section",
    ttRequired: isVi ? "BẮT BUỘC" : "REQUIRED",
    ttElective: isVi ? "TỰ CHỌN" : "ELECTIVE",
    ttTeacher: isVi ? "Giảng viên:" : "Teacher:",
    ttDuration: isVi ? "Thời lượng:" : "Duration:",
    ttPeriods: isVi ? "Tiết" : "Periods",
    ttCapacity: isVi ? "Sĩ số (SV):" : "Capacity:",
    ttStudents: isVi ? "Sinh viên" : "Students",
    ttRoomReq: isVi ? "Yêu cầu phòng:" : "Room Req:",
  };

  const daysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const getDayStr = (d, i) => isVi ? d : daysEn[i];

  const [scenarioId, setScenarioId] = useState("");
  const [scheduleRaw, setScheduleRaw] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataMessage, setDataMessage] = useState(null);
  const [isSolving, setIsSolving] = useState(false);
  const [solveMessage, setSolveMessage] = useState(null);
  const [apiScore, setApiScore] = useState({ hard: 0, soft: 0 });
  const [selectedMajor, setSelectedMajor] = useState("ALL");
  const [scheduleState, setScheduleState] = useState("empty");
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const majors = useMemo(() => {
    const set = new Set(lessons.map((l) => l.major).filter(Boolean));
    return ["ALL", ...Array.from(set)];
  }, [lessons]);

  useEffect(() => {
    if (!majors.includes(selectedMajor)) setSelectedMajor("ALL");
  }, [majors, selectedMajor]);

  const filteredLessons = useMemo(() => {
    if (selectedMajor === "ALL") return lessons;
    return lessons.filter((l) => l.major === selectedMajor);
  }, [lessons, selectedMajor]);

  const allUnassigned = lessons.filter((l) => !l.slotId);
  const unassignedLessons = filteredLessons.filter((l) => !l.slotId);
  const allPlaced = lessons.filter((l) => l.slotId);
  const placedLessons = filteredLessons.filter((l) => l.slotId);

  const cellMap = useMemo(() => {
    const map = {};
    placedLessons.forEach((l) => {
      if (!l.slotId) return;
      if (!map[l.slotId]) map[l.slotId] = [];
      map[l.slotId].push(l);
    });
    return map;
  }, [placedLessons]);

  /* ─── Drag & Drop ─── */
  const onDragStart = useCallback((e, lessonId) => {
    setDragId(lessonId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lessonId);
  }, []);

  const onDragEnd = useCallback(() => {
    setDragId(null);
    setDragOver(null);
  }, []);

  const onCellDragOver = useCallback((e, slotKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(slotKey);
  }, []);

  const onCellDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  const onCellDrop = useCallback((e, slotKey) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (!id) return;
    setLessons((prev) => prev.map((l) => l.id === id ? { ...l, slotId: slotKey } : l));
    setDragId(null);
    setDragOver(null);
    if (scheduleState === "loaded") setScheduleState("manual");
  }, [dragId, scheduleState]);

  const onPanelDrop = useCallback((e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (!id) return;
    setLessons((prev) => prev.map((l) => l.id === id ? { ...l, slotId: null } : l));
    setDragId(null);
    setDragOver(null);
  }, [dragId]);

  const onPanelDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver("panel");
  }, []);

  /* ─── API handlers ─── */
  const handleLoad = async () => {
    const tid = scenarioId.trim();
    if (!tid) { setDataMessage({ type: "error", text: t.errInvalidId }); return; }
    setIsLoadingData(true); setDataMessage(null); setSolveMessage(null);
    try {
      const result = await getScheduleResult(tid);
      const schedule = result?.schedule || result;
      if (!schedule?.lessons) throw new Error(t.errInvalidData);
      setScheduleRaw(schedule);
      setLessons(buildLessonsFromSchedule(schedule, false));
      setApiScore({ hard: 0, soft: 0 });
      setScenarioId(result?.scenarioId || tid);
      setScheduleState("loaded");
      setDataMessage({ type: "success", text: t.loadedSuccess(schedule.lessons.length) });
    } catch (err) {
      setDataMessage({ type: "error", text: `${t.errPrefix}${err.message}` });
    } finally { setIsLoadingData(false); }
  };

  const handleLoadMock = () => {
    const payload = mockSchedule?.schedule ? mockSchedule : { schedule: mockSchedule };
    const schedule = payload.schedule || payload;
    if (!schedule?.lessons) {
      setDataMessage({ type: "error", text: t.mockInvalid });
      return;
    }
    setScheduleRaw(schedule);
    setLessons(buildLessonsFromSchedule(schedule, true));
    setApiScore({
      hard: payload.hardScore ?? schedule.hardScore ?? 0,
      soft: payload.softScore ?? schedule.softScore ?? 0,
    });
    setScenarioId(payload.scenarioId || "mock-001");
    setScheduleState("solved");
    setSolveMessage(null);
    setDataMessage({ type: "success", text: t.mockSuccess });
  };

  const handleSolve = async () => {
    if (!scheduleRaw) { setSolveMessage({ type: "error", text: t.errNoData }); return; }
    const tid = scenarioId.trim() || `scenario-${Date.now()}`;
    setIsSolving(true); setSolveMessage({ type: "info", text: t.sendingReq });
    try {
      const result = await solveSchedule({ scenarioId: tid, schedule: scheduleRaw, saveScenario: true, saveResult: true });
      const schedule = result?.schedule || result;
      if (!schedule?.lessons) throw new Error(t.errInvalidData);
      setLessons(buildLessonsFromSchedule(schedule, true));
      setScheduleRaw(schedule);
      setApiScore({ hard: schedule.hardScore ?? 0, soft: schedule.softScore ?? 0 });
      if (result?.scenarioId) setScenarioId(result.scenarioId);
      setScheduleState("solved");
      setSolveMessage({ type: schedule.hardScore === 0 ? "success" : "warning", text: t.solveSuccess(schedule.hardScore ?? 0, schedule.softScore ?? 0) });
    } catch (err) {
      setSolveMessage({ type: "error", text: `${t.errPrefix}${err.message}` });
    } finally { setIsSolving(false); }
  };

  const handleReset = () => {
    if (scheduleRaw) { setLessons(buildLessonsFromSchedule(scheduleRaw, false)); setScheduleState("loaded"); }
    else { setLessons([]); setScheduleState("empty"); }
    setSolveMessage(null); setApiScore({ hard: 0, soft: 0 });
  };

  const getGridRowStart = (pid) => {
    if (pid === "break") return 7;
    const p = Number(pid);
    return p <= 5 ? p + 1 : p + 2;
  };

  const stateMap = {
    empty: { text: t.stateEmpty, cls: "state-empty" },
    loaded: { text: t.stateLoaded, cls: "state-loaded" },
    manual: { text: t.stateManual, cls: "state-manual" },
    solved: { text: t.stateSolved, cls: "state-solved" },
  };
  const st = stateMap[scheduleState] || stateMap.empty;

  /* ─── Lesson Card (reusable) ─── */
  const LessonCard = ({ lesson, variant = "grid" }) => {
    const cardRef = useRef(null);
    const [flipLeft, setFlipLeft] = useState(false);

    const handleMouseEnter = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        setFlipLeft(spaceRight < 350);
      }
    };

    return (
      <div
        ref={cardRef}
        className={`lesson-card ${variant} ${lesson.major} ${dragId === lesson.id ? "dragging" : ""}`}
        draggable={!readOnly}
        onDragStart={readOnly ? undefined : (e) => onDragStart(e, lesson.id)}
        onDragEnd={readOnly ? undefined : onDragEnd}
        onMouseEnter={handleMouseEnter}
      >
        <div className="lesson-head">
          <span className="lesson-major">{lesson.major}</span>
          <span className="lesson-section">{lesson.section}</span>
          {!readOnly && variant === "grid" && <span className="lesson-remove" title={t.removeFromSchedule} onClick={() => setLessons((p) => p.map((l) => l.id === lesson.id ? { ...l, slotId: null } : l))}>✕</span>}
        </div>
        <strong>{lesson.name}</strong>
        <span className="lesson-teacher">{lesson.teacher}</span>
        <div className="lesson-meta">
          <span className="meta-room">{lesson.reqRoom}</span>
          <span className="meta-cap">{lesson.cap} SV</span>
        </div>
        {/* Hover tooltip */}
        <div className={`lesson-tooltip ${flipLeft ? "flip-left" : ""}`}>
          <div className="tt-row-top">
            <span className="tt-major">{lesson.major}</span>
            <span className="tt-section">{t.ttSection} {lesson.section}</span>
            <span className={`tt-req-badge ${lesson.isRequired ? "required" : "elective"}`}>
              {lesson.isRequired ? t.ttRequired : t.ttElective}
            </span>
          </div>
          <div className="tt-name">{lesson.name}</div>
          <div className="tt-teacher-row">
            <span className="tt-label">{t.ttTeacher}</span>
            <strong>{lesson.teacher}</strong>{" "}
            <span className={`tt-type ${lesson.type === "Guest" ? "guest" : ""}`}>({lesson.type})</span>
          </div>
          <div className="tt-details">
            <div className="tt-detail-col">
              <span className="tt-label">{t.ttDuration}</span>
              <span className="tt-val">⏱ {lesson.duration || 1} {t.ttPeriods}</span>
            </div>
            <div className="tt-detail-col">
              <span className="tt-label">{t.ttCapacity}</span>
              <span className="tt-val">👥 {lesson.cap} {t.ttStudents}</span>
            </div>
          </div>
          <div className="tt-room-row">
            <span className="tt-label">{t.ttRoomReq}</span>
            <span className="tt-val"> {lesson.reqRoom}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`schedv2 ${dragId ? "is-dragging" : ""}`}>
      {/* ═══ Header ═══ */}
      {!readOnly && (
        <div className="schedv2-header">
          <div className="schedv2-actions">
            <input className="schedv2-input" type="text" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} placeholder="Scenario ID" />
            <button className="schedv2-btn ghost" type="button" onClick={handleLoad} disabled={isLoadingData}>
              {isLoadingData ? t.loading : t.loadData}
            </button>
            <button className="schedv2-btn ghost" type="button" onClick={handleLoadMock}>
              {t.loadMock}
            </button>
            <button className="schedv2-btn primary" type="button" onClick={handleSolve} disabled={isSolving || !scheduleRaw} title={!scheduleRaw ? t.loadDataFirst : ""}>
              {isSolving ? <span className="btn-solving"><span className="solving-spinner" />{t.schedulingBtn}</span> : t.autoSchedule}
            </button>
            <button className="schedv2-btn ghost" type="button" onClick={handleReset}>{t.reset}</button>
          </div>
        </div>
      )}

      {/* ═══ Status row ═══ */}
      <div className="schedv2-status-row">
        <span className={`schedv2-state-label ${st.cls}`}>{st.icon} {st.text}</span>
        {(dataMessage || solveMessage) && (
          <div className="schedv2-messages">
            {dataMessage && <span className={`schedv2-msg ${dataMessage.type}`}>{dataMessage.text}</span>}
            {solveMessage && <span className={`schedv2-msg ${solveMessage.type}`}>{solveMessage.text}</span>}
          </div>
        )}
        <div className="schedv2-score">
          <div className={`score-pill ${apiScore.hard < 0 ? "warn" : "ok"}`}>Hard: {apiScore.hard}</div>
          <div className="score-pill soft">Soft: {apiScore.soft}</div>
        </div>
      </div>

      {/* ═══ Toolbar ═══ */}
      {!readOnly && (
        <div className="schedv2-toolbar">
          <div className="schedv2-filters">
            {majors.map((m) => (
              <button key={m} type="button" className={`schedv2-filter ${selectedMajor === m ? "active" : ""}`} onClick={() => setSelectedMajor(m)}>
                {m === "ALL" ? t.allMajors : m}
              </button>
            ))}
          </div>
          <div className="schedv2-drag-hint">
            {scheduleState !== "empty" && <span>{t.dragHint}</span>}
          </div>
        </div>
      )}

      {/* ═══ Main layout ═══ */}
      <div className={readOnly ? "schedv2-layout schedv2-layout-readonly" : "schedv2-layout"}>
        {/* Left panel: Pending lessons */}
        {!readOnly && (
          <aside className="schedv2-panel" onDragOver={onPanelDragOver} onDragLeave={onCellDragLeave} onDrop={onPanelDrop}>
            <div className="panel-header">
              <span>{t.pendingClasses} {selectedMajor !== "ALL" ? `(${selectedMajor})` : ""}</span>
              <span className="panel-count">{unassignedLessons.length}</span>
            </div>
            <div className={`panel-list ${dragOver === "panel" ? "drop-target" : ""}`}>
              {unassignedLessons.length === 0 ? (
                <div className="panel-empty">
                  {scheduleState === "empty" ? t.enterScenario : t.allScheduled}
                </div>
              ) : (
                unassignedLessons.map((l) => <LessonCard key={l.id} lesson={l} variant="pending" />)
              )}
            </div>
          </aside>
        )}

        {/* Center: Timetable grid */}
        <section className="schedv2-grid">
          <div className="schedv2-grid-head">
            {t.timetable} {selectedMajor !== "ALL" ? `– ${selectedMajor}` : ""}
            {scheduleState === "solved" && <span className="grid-head-solved">{t.scheduled}</span>}
          </div>
          <div className="schedv2-grid-wrap">
            <div className="schedv2-grid-table" style={{ gridTemplateColumns: "70px repeat(6, minmax(140px, 1fr))", gridTemplateRows: "36px repeat(5, minmax(60px, auto)) 30px repeat(7, minmax(60px, auto))" }}>
              <div className="schedv2-grid-row header">
                <div className="schedv2-grid-cell time">{t.period}</div>
                {DAYS.map((d, i) => <div key={d} className={`schedv2-grid-cell day ${i === 5 ? "sat" : ""}`}>{getDayStr(d, i)}</div>)}
              </div>

              {PERIODS.map((period) => {
                const rowStart = getGridRowStart(period.id);
                if (period.id === "break") {
                  return <div key="break" className="schedv2-break" style={{ gridRowStart: rowStart, gridColumnStart: 1, gridColumnEnd: 8 }}>{period.time} – {t.lunchBreak}</div>;
                }
                return (
                  <div key={period.id} className="schedv2-grid-row" style={{ gridRowStart: rowStart }}>
                    <div className="schedv2-grid-cell time"><strong>{isVi ? period.name : `Period ${period.id}`}</strong><span>{period.time}</span></div>
                    {DAYS.map((_, di) => {
                      const sk = `${di}-${period.id}`;
                      const cls = cellMap[sk] || [];
                      const isOver = !readOnly && dragOver === sk;
                      return (
                        <div key={sk}
                          className={`schedv2-grid-cell body ${di === 5 ? "sat" : ""} ${isOver ? "drop-target" : ""}`}
                          onDragOver={readOnly ? undefined : (e) => onCellDragOver(e, sk)}
                          onDragLeave={readOnly ? undefined : onCellDragLeave}
                          onDrop={readOnly ? undefined : (e) => onCellDrop(e, sk)}
                        >
                          {cls.map((l) => <LessonCard key={l.id} lesson={l} variant="grid" />)}
                          {isOver && cls.length === 0 && <div className="drop-placeholder">{t.dropHere}</div>}
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
        {!readOnly && (
          <aside className="schedv2-panel right">
            <div className="panel-header"><span>{t.stats}</span></div>
            <div className="panel-score">
              <div className={`score-box ${apiScore.hard < 0 ? "warn" : "ok"}`}><span>HARD</span><strong>{apiScore.hard}</strong></div>
              <div className="score-box soft"><span>SOFT</span><strong>{apiScore.soft}</strong></div>
            </div>
            <div className="panel-stats">
              <div className="stat-item"><span className="stat-label">{t.totalClasses}</span><span className="stat-value">{lessons.length}</span></div>
              <div className="stat-item placed"><span className="stat-label">{t.scheduledCount}</span><span className="stat-value">{allPlaced.length}</span></div>
              <div className="stat-item pending"><span className="stat-label">{t.pendingCount}</span><span className="stat-value">{allUnassigned.length}</span></div>
            </div>
            {lessons.length > 0 && (
              <div className="panel-progress">
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${lessons.length ? (allPlaced.length / lessons.length * 100) : 0}%` }} /></div>
                <span className="progress-text">{lessons.length ? Math.round(allPlaced.length / lessons.length * 100) : 0}% {t.completed}</span>
              </div>
            )}
            <div className="panel-log">
              {isSolving ? t.callingApi : solveMessage?.text || (scheduleState !== "empty" ? t.ready : t.loadToStart)}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
