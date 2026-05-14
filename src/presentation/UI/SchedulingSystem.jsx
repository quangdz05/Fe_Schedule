import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  getScheduleResult, solveSchedule, waitForSolveResult,
  evaluateMove, saveSession
} from "../../services/scheduleService";
import SectionPicker from "./SectionPicker";
import SolverProgress from "./SolverProgress";
import ConflictPanel from "./ConflictPanel";

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
  // Backend uses C# DayOfWeek: Monday=1, Tuesday=2, ..., Saturday=6
  if (v >= 1 && v <= 6) return v - 1;
  return null;  // Sunday=0 not displayed
};

const inferMajor = (subjectName, groupName) => {
  const h = `${subjectName || ""} ${groupName || ""}`.toUpperCase();
  for (const m of KNOWN_MAJORS) { if (h.includes(m)) return m; }
  return "GEN";
};

// Parse year from group.year field (from API)
const parseYear = (year) => {
  const v = Number(year);
  return Number.isNaN(v) || v === 0 ? null : v;
};

// Detect shared course: section has groups from 2+ different majors
const isSharedSection = (section) => {
  const groups = section?.studentGroups || [];
  if (groups.length < 2) return false;
  const seenMajors = new Set();
  for (const g of groups) {
    for (const m of KNOWN_MAJORS) {
      if ((g.name || "").toUpperCase().includes(m)) { seenMajors.add(m); break; }
    }
  }
  return seenMajors.size > 1;
};

const mapReqRoom = (rt, dm) => {
  if (dm === 1) return "Online";
  return rt === 1 ? "Lab" : "Theory";
};

const buildLessonsFromSchedule = (schedule, assignSlots = true) => {
  const tMap = new Map((schedule.teachers || []).map((t) => [t.id, t]));
  const courseMap = new Map((schedule.courses || []).map((c) => [c.id, c]));
  const sectionMap = new Map((schedule.courseSections || []).map((cs) => [cs.id, cs]));
  // fallback: old subjects field
  const sMap = new Map((schedule.subjects || []).map((s) => [s.id, s]));
  const gMap = new Map((schedule.studentGroups || []).map((g) => [g.id, g]));
  const tsMap = new Map((schedule.timeSlots || []).map((t) => [t.id, t]));

  return (schedule.lessons || []).map((lesson) => {
    const section = sectionMap.get(lesson.courseSectionId);
    const course = section ? courseMap.get(section.courseId) : null;
    // Fallback to old subjectId path
    const subject = !course ? sMap.get(lesson.subjectId) : null;
    // Multi-teacher: collect from sectionTeachers
    const sectionTeachers = (section?.sectionTeachers || []);
    const teacherNames = sectionTeachers.length > 0
      ? sectionTeachers.map(st => tMap.get(st.teacherId)?.name).filter(Boolean)
      : [tMap.get(lesson.teacherId)?.name].filter(Boolean);
    // Use sessionDuration directly from API
    const duration = lesson.sessionDuration || 1;
    const group = gMap.get(lesson.studentGroupId ||
      (section?.studentGroupIds?.[0]));
    const ts = tsMap.get(lesson.timeSlotId);
    let slotId = null;
    if (assignSlots && ts && lesson.timeSlotId != null) {
      const di = mapDayIndex(ts.dayOfWeek);
      const pi = getPeriodIdFromTime(ts.startTime);
      slotId = di !== null && pi ? `${di}-${pi}` : null;
    }
    const courseName = course?.name || subject?.name || `Course ${lesson.courseSectionId || lesson.subjectId}`;
    const sec = courseName.match(/HP\d+/i);
    const tn = teacherNames.join(", ") || `GV ${lesson.teacherId}`;
    const isReq = (course?.courseType ?? 0) === 0;
    // Get year from primary student group
    const year = parseYear(group?.year);
    // Shared: section has >1 group from different majors
    const isShared = isSharedSection(section);
    return {
      id: String(lesson.id),
      name: courseName,
      section: sec ? sec[0].toUpperCase() : "HP1",
      isRequired: isReq,
      teacher: tn,
      type: /\bGS|PGS\b/i.test(tn) ? "Guest" : "Resident",
      reqRoom: mapReqRoom(lesson.requiredRoomType ?? course?.requiredRoomType, lesson.deliveryMode),
      cap: group?.size ?? 0,
      duration,
      sessionDuration: duration,
      major: inferMajor(courseName, group?.name),
      year,
      isShared,
      slotId,
      isPinned: lesson.isPinned ?? false,
      courseSectionId: lesson.courseSectionId,
    };
  });
};


/* ═══════════════ MAIN COMPONENT ═══════════════ */

export default function SchedulingSystem() {
  const [scenarioId, setScenarioId] = useState("");
  const [sessionId, setSessionId] = useState(null);         // jobId từ /solve
  const [scheduleRaw, setScheduleRaw] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataMessage, setDataMessage] = useState(null);
  const [isSolving, setIsSolving] = useState(false);
  const [solveJobId, setSolveJobId] = useState(null);       // hiển thị SolverProgress
  const [solveMessage, setSolveMessage] = useState(null);
  const [apiScore, setApiScore] = useState({ hard: 0, soft: 0 });
  const [selectedMajor, setSelectedMajor] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState(null);  // null = all years
  const [scheduleState, setScheduleState] = useState("empty");
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [saveMessage, setSaveMessage] = useState(null);
  const [showSectionPicker, setShowSectionPicker] = useState(true);
  const [evaluatePopup, setEvaluatePopup] = useState(null);

  // Available majors from lessons
  const majors = useMemo(() => {
    const set = new Set(lessons.map((l) => l.major).filter(v => v && v !== "GEN"));
    return ["ALL", ...Array.from(set).sort()];
  }, [lessons]);

  // Available years for selected major
  const availableYears = useMemo(() => {
    if (selectedMajor === "ALL") return [];
    const yrs = new Set(
      lessons
        .filter(l => l.major === selectedMajor && l.year)
        .map(l => l.year)
    );
    return Array.from(yrs).sort();
  }, [lessons, selectedMajor]);

  // Reset year when major changes
  useEffect(() => {
    setSelectedYear(null);
  }, [selectedMajor]);

  useEffect(() => {
    if (!majors.includes(selectedMajor)) setSelectedMajor("ALL");
  }, [majors, selectedMajor]);

  const filteredLessons = useMemo(() => {
    let list = lessons;
    if (selectedMajor !== "ALL") list = list.filter(l => l.major === selectedMajor);
    if (selectedYear !== null)   list = list.filter(l => l.year === selectedYear);
    return list;
  }, [lessons, selectedMajor, selectedYear]);

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

  // ─── Compute horizontal layout for concurrent lessons (Google Calendar style) ───
  // For each day, run an interval-scheduling algorithm to assign colIndex / totalCols
  // so overlapping lessons are displayed side-by-side instead of stacking.
  const dayLayoutMap = useMemo(() => {
    const result = {}; // lessonId → { colIndex, totalCols }

    // Group placed lessons by dayIndex
    const byDay = {};
    placedLessons.forEach((l) => {
      if (!l.slotId) return;
      const [diStr] = l.slotId.split("-");
      const di = Number(diStr);
      if (!byDay[di]) byDay[di] = [];
      byDay[di].push(l);
    });

    Object.entries(byDay).forEach(([, dayLessons]) => {
      // Build intervals: [startPeriod, endPeriod (exclusive)]
      const withInterval = dayLessons.map((l) => {
        const pid = Number(l.slotId.split("-")[1]);
        const dur = l.duration || 1;
        return { l, start: pid, end: pid + dur };
      });

      // Sort by start
      withInterval.sort((a, b) => a.start - b.start);

      // Greedy column assignment: cols[c] = end of last lesson in column c
      const cols = [];
      withInterval.forEach((item) => {
        let placed = false;
        for (let c = 0; c < cols.length; c++) {
          if (cols[c] <= item.start) { // column c is free
            item.colIndex = c;
            cols[c] = item.end;
            placed = true;
            break;
          }
        }
        if (!placed) {
          item.colIndex = cols.length;
          cols.push(item.end);
        }
      });

      // Second pass: find totalCols for each overlapping group
      // For each lesson, totalCols = max colIndex among all lessons that overlap with it, +1
      withInterval.forEach((item) => {
        const overlapping = withInterval.filter(
          (other) => other.start < item.end && other.end > item.start
        );
        item.totalCols = Math.max(...overlapping.map((o) => o.colIndex)) + 1;
      });

      withInterval.forEach((item) => {
        result[item.l.id] = { colIndex: item.colIndex, totalCols: item.totalCols };
      });
    });

    return result;
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
    if (!tid) { setDataMessage({ type: "error", text: "Vui lòng nhập Scenario ID." }); return; }
    setIsLoadingData(true); setDataMessage(null); setSolveMessage(null);
    try {
      const result = await getScheduleResult(tid);
      const schedule = result?.schedule || result;
      if (!schedule?.lessons) throw new Error("API không trả về dữ liệu hợp lệ.");
      setScheduleRaw(schedule);
      setLessons(buildLessonsFromSchedule(schedule, true));
      setConflicts(schedule.conflicts || []);
      setApiScore({ hard: schedule.hardScore ?? 0, soft: schedule.softScore ?? 0 });
      setScenarioId(result?.scenarioId || tid);
      setScheduleState("solved");
      setShowSectionPicker(false);
      setDataMessage({ type: "success", text: `Đã tải ${schedule.lessons.length} lớp từ DB.` });
    } catch (err) {
      setDataMessage({ type: "error", text: `Lỗi: ${err.message}` });
    } finally { setIsLoadingData(false); }
  };

  const handleSolve = async () => {
    if (selectedSectionIds.length === 0) {
      setSolveMessage({ type: "error", text: "Chọn ít nhất 1 section để xếp lịch." });
      return;
    }
    setIsSolving(true);
    setSolveMessage({ type: "info", text: "Đang gửi yêu cầu..." });
    try {
      // Bước 1: gửi solve → nhận jobId
      const { jobId } = await solveSchedule("Lịch mới", selectedSectionIds);
      setSessionId(jobId);
      setSolveJobId(jobId);
      // SolverProgress sẽ poll qua onCompleted/onFailed
    } catch (err) {
      setSolveMessage({ type: "error", text: `Lỗi: ${err.message}` });
      setIsSolving(false);
    }
  };

  const handleSolveCompleted = (pollResult) => {
    setSolveJobId(null);
    setIsSolving(false);

    // pollResult = { jobId, status, progress, result: { scenarioId, hardScore, softScore, schedule } }
    const solveResult = pollResult?.result || pollResult;
    const schedule = solveResult?.schedule;

    if (!schedule?.lessons) {
      setSolveMessage({ type: "error", text: "API không trả về kết quả hợp lệ." });
      return;
    }

    setSessionId(pollResult?.jobId || solveResult?.scenarioId);
    setLessons(buildLessonsFromSchedule(schedule, true));
    setScheduleRaw(schedule);
    setConflicts(schedule.conflicts || []);
    const hard = solveResult.hardScore ?? schedule.hardScore ?? 0;
    const soft = solveResult.softScore ?? schedule.softScore ?? 0;
    setApiScore({ hard, soft });
    setScheduleState("solved");
    setShowSectionPicker(false);
    setSolveMessage({
      type: hard === 0 ? "success" : "warning",
      text: `Xếp xong! Hard: ${hard}, Soft: ${soft}`
    });
  };

  const handleSolveFailed = (err) => {
    setSolveJobId(null);
    setIsSolving(false);
    setSolveMessage({ type: "error", text: `Solver thất bại: ${err.message}` });
  };

  const handleSave = async () => {
    if (!sessionId) { setSaveMessage({ type: "error", text: "Chưa có session để lưu." }); return; }
    setSaveMessage({ type: "info", text: "Đang lưu..." });
    try {
      await saveSession(sessionId);
      setSaveMessage({ type: "success", text: "Da luu lich vao Database!" });
    } catch (err) {
      setSaveMessage({ type: "error", text: `Lỗi lưu: ${err.message}` });
    }
  };

  const handleReset = () => {
    setLessons([]); setScheduleRaw(null); setScheduleState("empty");
    setConflicts([]); setHighlightedIds(new Set()); setSolveJobId(null);
    setSessionId(null); setSolveMessage(null); setSaveMessage(null);
    setApiScore({ hard: 0, soft: 0 }); setShowSectionPicker(true);
  };


  const getGridRowStart = (pid) => {
    if (pid === "break") return 7;
    const p = Number(pid);
    return p <= 5 ? p + 1 : p + 2;
  };

  const stateMap = {
    empty: { text: "Chua co du lieu", cls: "state-empty", icon: "" },
    loaded: { text: "Da tai – Cho xep lich", cls: "state-loaded", icon: "" },
    manual: { text: "Dang xep tay", cls: "state-manual", icon: "" },
    solved: { text: "Da xep xong", cls: "state-solved", icon: "" },
  };
  const st = stateMap[scheduleState] || stateMap.empty;

  /* ─── Lesson Card ─── */
  const LessonCard = ({ lesson, variant = "grid" }) => {
    const cardRef = useRef(null);
    const [flipLeft, setFlipLeft] = useState(false);
    const isHighlighted = highlightedIds.has(Number(lesson.id));

    const handleMouseEnter = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setFlipLeft(window.innerWidth - rect.right < 300);
      }
    };

    const cardClass = [
      "lesson-card",
      variant,
      lesson.isRequired ? "required" : "elective",
      lesson.isShared ? "shared" : "",
      dragId === lesson.id ? "dragging" : "",
      isHighlighted ? "highlighted" : "",
      lesson.isPinned ? "pinned" : "",
    ].filter(Boolean).join(" ");

    return (
      <div
        ref={cardRef}
        className={cardClass}
        draggable
        onDragStart={(e) => onDragStart(e, lesson.id)}
        onDragEnd={onDragEnd}
        onMouseEnter={handleMouseEnter}
      >
        <div className="lesson-head">
          <span className="lesson-major">{lesson.major}</span>
          <span className="lesson-section">{lesson.section}</span>
          {lesson.year && <span className={`lesson-year y${lesson.year}`}>Y{lesson.year}</span>}
          {lesson.isShared && <span className="lesson-shared-badge">CHUNG</span>}
          {lesson.isPinned && <span className="lesson-pin">[pin]</span>}
          {variant === "grid" && (
            <span className="lesson-remove" title="Gỡ khỏi lịch"
              onClick={() => setLessons((p) => p.map((l) => l.id === lesson.id ? { ...l, slotId: null } : l))}>
              ×
            </span>
          )}
        </div>
        <strong>{lesson.name}</strong>
        <span className="lesson-teacher">{lesson.teacher}</span>
        <div className="lesson-meta">
          <span className="meta-room">{lesson.reqRoom}</span>
          <span className="meta-cap">{lesson.cap} SV</span>
          {lesson.duration > 1 && <span className="meta-duration">{lesson.duration} tiết</span>}
        </div>
        <div className={`lesson-tooltip ${flipLeft ? "flip-left" : ""}`}>
          <div className="tt-row-top">
            <span className="tt-major">{lesson.major}</span>
            {lesson.year && <span className={`lesson-year y${lesson.year}`}>Năm {lesson.year}</span>}
            <span className="tt-section">{lesson.section}</span>
            <span className={`tt-req-badge ${lesson.isRequired ? "required" : "elective"}`}>
              {lesson.isRequired ? "BẮT BUỘC" : "TỰ CHỌN"}
            </span>
            {lesson.isShared && <span className="lesson-shared-badge">CHUNG</span>}
          </div>
          <div className="tt-name">{lesson.name}</div>
          <div className="tt-teacher-row">
            <span className="tt-label">Giảng viên:</span>
            <strong>{lesson.teacher}</strong>{" "}
            <span className={`tt-type ${lesson.type === "Guest" ? "guest" : ""}`}>({lesson.type})</span>
          </div>
          <div className="tt-details">
            <div className="tt-detail-col">
              <span className="tt-label">Thời lượng:</span>
              <span className="tt-val">{lesson.duration || 1} tiết</span>
            </div>
            <div className="tt-detail-col">
              <span className="tt-label">Sĩ số:</span>
              <span className="tt-val">{lesson.cap} SV</span>
            </div>
          </div>
          <div className="tt-room-row">
            <span className="tt-label">Phòng yêu cầu:</span>
            <span className="tt-val"> {lesson.reqRoom}</span>
          </div>
        </div>
      </div>
    );
  };   // end LessonCard

  return (
    <div className={`schedv2 ${dragId ? "is-dragging" : ""}`}>
      {/* SolverProgress overlay */}
      {solveJobId && (
        <SolverProgress
          jobId={solveJobId}
          onCompleted={handleSolveCompleted}
          onFailed={handleSolveFailed}
        />
      )}

      {/* EvaluateMove popup */}
      {evaluatePopup && (
        <div className="evaluate-popup-overlay">
          <div className="evaluate-popup">
            <div className="ep-title">Danh gia di chuyen</div>
            <div className="ep-scores">
              <div className={`ep-score ${(evaluatePopup.result?.deltaHardScore ?? 0) < 0 ? "bad" : "good"}`}>
                Hard δ: {evaluatePopup.result?.deltaHardScore ?? "N/A"}
              </div>
              <div className="ep-score">
                Soft δ: {evaluatePopup.result?.deltaSoftScore ?? "N/A"}
              </div>
            </div>
            {evaluatePopup.result?.addedConflicts?.length > 0 && (
              <div className="ep-conflicts">Them {evaluatePopup.result.addedConflicts.length} conflict moi</div>
            )}
            {evaluatePopup.result?.resolvedConflicts?.length > 0 && (
              <div className="ep-resolved">Giai quyet {evaluatePopup.result.resolvedConflicts.length} conflict</div>
            )}
            <div className="ep-actions">
              <button className="ep-btn confirm" onClick={() => {
                setLessons((prev) => prev.map((l) => l.id === evaluatePopup.lessonId ? { ...l, slotId: evaluatePopup.pendingSlot } : l));
                if (scheduleState === "solved") setScheduleState("manual");
                setEvaluatePopup(null);
              }}>Xác nhận</button>
              <button className="ep-btn cancel" onClick={() => setEvaluatePopup(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Header ═══ */}
      <div className="schedv2-header">
        <div className="schedv2-actions">
          <input className="schedv2-input" type="text" value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)} placeholder="Scenario ID (tải từ DB)" />
          <button className="schedv2-btn ghost" type="button" onClick={handleLoad} disabled={isLoadingData}>
            {isLoadingData ? "Dang tai..." : "Tai tu DB"}
          </button>
          <button className="schedv2-btn ghost" type="button"
            onClick={() => setShowSectionPicker((v) => !v)} disabled={isSolving}>
            {showSectionPicker ? "An bang chon" : "Chon sections"}
          </button>
          <button className="schedv2-btn primary" type="button" onClick={handleSolve}
            disabled={isSolving || selectedSectionIds.length === 0}
            title={selectedSectionIds.length === 0 ? "Chọn ít nhất 1 section" : ""}>
            {isSolving
              ? <span className="btn-solving"><span className="solving-spinner" />Dang xep...</span>
              : `Xep lich (${selectedSectionIds.length} sections)`}
          </button>
          {sessionId && scheduleState !== "empty" && (
            <button className="schedv2-btn save" type="button" onClick={handleSave}>
              Luu vao Database
            </button>
          )}
          <button className="schedv2-btn ghost" type="button" onClick={handleReset}>Reset</button>
        </div>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div className={`schedv2-save-msg ${saveMessage.type}`}>{saveMessage.text}</div>
      )}

      {/* SectionPicker */}
      {showSectionPicker && (
        <div className="schedv2-section-picker-wrap">
          <SectionPicker
            onSectionsSelected={setSelectedSectionIds}
            disabled={isSolving}
          />
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
      <div className="schedv2-toolbar">
        {/* Level 1: Major filter */}
        <div className="schedv2-filter-row">
          <span className="schedv2-filter-label">Khoa</span>
          {majors.map((m) => (
            <button key={m} type="button"
              className={`schedv2-filter ${selectedMajor === m ? "active" : ""}`}
              onClick={() => setSelectedMajor(m)}>
              {m === "ALL" ? "Toàn trường" : m}
            </button>
          ))}
        </div>

        {/* Level 2: Year filter — only show when a major is selected and has multiple years */}
        {selectedMajor !== "ALL" && availableYears.length > 0 && (
          <div className="schedv2-filter-row">
            <span className="schedv2-filter-label">Năm</span>
            <button type="button"
              className={`schedv2-filter ${selectedYear === null ? "active" : ""}`}
              onClick={() => setSelectedYear(null)}>
              Tất cả
            </button>
            {availableYears.map(yr => (
              <button key={yr} type="button"
                className={`schedv2-filter year${yr} ${selectedYear === yr ? `active year${yr}` : ""}`}
                onClick={() => setSelectedYear(yr)}>
                Năm {yr}
              </button>
            ))}
          </div>
        )}

        {/* Legend + drag hint */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div className="schedv2-legend">
            <span><span className="legend-dot required" />Bắt buộc</span>
            <span><span className="legend-dot elective" />Tự chọn</span>
            {availableYears.includes(2) && <span><span className="legend-dot year2" />Năm 2</span>}
            {availableYears.includes(3) && <span><span className="legend-dot year3" />Năm 3</span>}
            {availableYears.includes(4) && <span><span className="legend-dot year4" />Năm 4</span>}
          </div>
          <div className="schedv2-drag-hint">
            {scheduleState !== "empty" && <span>Kéo thả lớp học để xếp lịch thủ công</span>}
          </div>
        </div>
      </div>

      {/* ═══ Main layout ═══ */}
      <div className="schedv2-layout">
        {/* Left panel: Pending lessons */}
        <aside className="schedv2-panel" onDragOver={onPanelDragOver} onDragLeave={onCellDragLeave} onDrop={onPanelDrop}>
          <div className="panel-header">
            <span>Lớp chờ xếp {selectedMajor !== "ALL" ? `(${selectedMajor}${selectedYear ? ` – Năm ${selectedYear}` : ""})` : ""}</span>
            <span className="panel-count">{unassignedLessons.length}</span>
          </div>
          <div className="panel-legend">
            <span><span className="legend-dot required" />Bắt buộc</span>
            <span><span className="legend-dot elective" />Tự chọn</span>
          </div>
          <div className={`panel-list ${dragOver === "panel" ? "drop-target" : ""}`}>
            {unassignedLessons.length === 0 ? (
              <div className="panel-empty">
                {scheduleState === "empty"
                  ? "Chon sections va nhan 'Xep lich'."
                  : "Tat ca lop da duoc xep."}
              </div>
            ) : (
              unassignedLessons.map((l) => <LessonCard key={l.id} lesson={l} variant="pending" />)
            )}
          </div>
        </aside>

        {/* Center: Timetable grid */}
        <section className="schedv2-grid">
          <div className="schedv2-grid-head">
            Thời khóa biểu {selectedMajor !== "ALL" ? `– ${selectedMajor}` : ""}
            {scheduleState === "solved" && <span className="grid-head-solved">Da xep</span>}
          </div>
          <div className="schedv2-grid-wrap">
            {/* Grid: col 1 = time label, col 2-7 = Mon-Sat
                Rows: row 1 = header, rows 2-6 = Tiết 1-5, row 7 = break, rows 8-14 = Tiết 6-12 */}
            <div className="schedv2-grid-table"
              style={{
                gridTemplateColumns: "70px repeat(6, 1fr)",
                gridTemplateRows: "36px repeat(5, 60px) 30px repeat(7, 60px)"
              }}>

              {/* ── Header row ── */}
              <div className="schedv2-grid-cell time" style={{ gridRow: 1, gridColumn: 1 }}>Tiết</div>
              {DAYS.map((d, i) => (
                <div key={d} style={{ gridRow: 1, gridColumn: i + 2 }}
                  className={`schedv2-grid-cell day ${i === 5 ? "sat" : ""}`}>{d}</div>
              ))}

              {/* ── Time label column + empty drop cells ── */}
              {PERIODS.map((period) => {
                const rowStart = getGridRowStart(period.id);
                if (period.id === "break") {
                  return (
                    <div key="break" className="schedv2-break"
                      style={{ gridRow: rowStart, gridColumn: "1 / 8" }}>
                      {period.time} – NGHI TRUA
                    </div>
                  );
                }
                return (
                  <div key={`time-${period.id}`} className="schedv2-grid-cell time"
                    style={{ gridRow: rowStart, gridColumn: 1 }}>
                    <strong>{period.name}</strong>
                    <span>{period.time}</span>
                  </div>
                );
              })}

              {/* ── Empty drop-target cells (one per period×day) ── */}
              {PERIODS.filter(p => p.id !== "break").map((period) => {
                const rowStart = getGridRowStart(period.id);
                return DAYS.map((_, di) => {
                  const sk = `${di}-${period.id}`;
                  const isOver = dragOver === sk;
                  const hasLesson = (cellMap[sk] || []).length > 0;
                  return (
                    <div key={sk}
                      className={`schedv2-grid-cell body ${di === 5 ? "sat" : ""} ${isOver && !hasLesson ? "drop-target" : ""}`}
                      style={{ gridRow: rowStart, gridColumn: di + 2 }}
                      onDragOver={(e) => onCellDragOver(e, sk)}
                      onDragLeave={onCellDragLeave}
                      onDrop={(e) => onCellDrop(e, sk)}>
                      {isOver && !hasLesson && <div className="drop-placeholder">Thả vào đây</div>}
                    </div>
                  );
                });
              })}

              {/* ── Placed lessons ── absolute positioning within each day column ── */}
              {(() => {
                // Group placed lessons by dayIndex so we render one host per (day)
                // Each host spans the entire day column height, lessons are absolute inside
                const byDay = {};
                placedLessons.forEach((lesson) => {
                  if (!lesson.slotId) return;
                  const [diStr] = lesson.slotId.split("-");
                  const di = Number(diStr);
                  if (!byDay[di]) byDay[di] = [];
                  byDay[di].push(lesson);
                });

                // ROW_H: px height per period row in the grid
                // Grid rows: row1=header(36px), rows2-6=periods1-5(60px each),
                //            row7=break(30px), rows8-14=periods6-12(60px each)
                const ROW_H = 60;
                const BREAK_H = 30;
                const HEADER_H = 36;
                // Total height of the "day body" area (excluding header)
                const TOTAL_H = 5 * ROW_H + BREAK_H + 7 * ROW_H; // 5+break+7 rows

                // Convert period id → top offset in px from start of day body
                const periodToTop = (pid) => {
                  if (pid >= 1 && pid <= 5) return (pid - 1) * ROW_H;
                  if (pid >= 6 && pid <= 12) return 5 * ROW_H + BREAK_H + (pid - 6) * ROW_H;
                  return 0;
                };

                return Object.entries(byDay).map(([diStr, dayLessons]) => {
                  const di = Number(diStr);
                  return (
                    <div key={`day-host-${di}`}
                      className={`schedv2-day-host ${di === 5 ? "sat" : ""}`}
                      style={{
                        gridRow: `2 / 15`, // span all period rows (rows 2-14)
                        gridColumn: di + 2,
                        position: "relative",
                        height: TOTAL_H,
                        pointerEvents: "none", // drop targets still below
                        zIndex: 3,
                      }}>
                      {dayLessons.map((lesson) => {
                        const pid = Number(lesson.slotId.split("-")[1]);
                        const dur = lesson.duration || 1;
                        const layout = dayLayoutMap[lesson.id] || { colIndex: 0, totalCols: 1 };
                        const { colIndex, totalCols } = layout;

                        const top = periodToTop(pid);
                        // Height: sum of period heights covered, including break if spans it
                        let heightPx = 0;
                        for (let p = pid; p < pid + dur; p++) {
                          if (p === 6 && pid <= 5) heightPx += BREAK_H; // crossing break
                          heightPx += ROW_H;
                        }
                        // Don't cross the visual break row if lesson ends at p=5
                        // (dur rows starting from pid, break only if crossing)
                        // recalculate clean:
                        heightPx = 0;
                        for (let p = 0; p < dur; p++) {
                          const curPid = pid + p;
                          heightPx += ROW_H;
                          // If this period is period 5 and next would cross into afternoon, add break
                          if (curPid === 5 && p < dur - 1) heightPx += BREAK_H;
                        }

                        const GAP = 2; // px gap between side-by-side lessons
                        const widthPct = 100 / totalCols;
                        const leftPct = colIndex * widthPct;

                        return (
                          <div key={lesson.id}
                            className="schedv2-lesson-abs"
                            style={{
                              position: "absolute",
                              top: `${top}px`,
                              height: `${heightPx - GAP}px`,
                              left: `calc(${leftPct}% + ${colIndex * GAP}px)`,
                              width: `calc(${widthPct}% - ${colIndex * GAP + GAP}px)`,
                              pointerEvents: "auto",
                              zIndex: 4,
                              padding: "2px",
                              boxSizing: "border-box",
                              overflow: "hidden",
                            }}
                            onDragOver={(e) => onCellDragOver(e, lesson.slotId)}
                            onDragLeave={onCellDragLeave}
                            onDrop={(e) => onCellDrop(e, lesson.slotId)}>
                            <LessonCard lesson={lesson} variant="grid" />
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </section>

        {/* Right panel: Stats + ConflictPanel */}
        <aside className="schedv2-panel right">
          <div className="panel-header"><span>Thong ke</span></div>
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
              <div className="progress-bar"><div className="progress-fill"
                style={{ width: `${lessons.length ? (allPlaced.length / lessons.length * 100) : 0}%` }} /></div>
              <span className="progress-text">{lessons.length ? Math.round(allPlaced.length / lessons.length * 100) : 0}% hoàn thành</span>
            </div>
          )}
          <ConflictPanel
            conflicts={conflicts}
            onHighlightLessons={(ids) => setHighlightedIds(new Set(ids))}
          />
        </aside>
      </div>
    </div>
  );
}
