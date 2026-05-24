import { memo, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  getScheduleResult, solveSchedule, waitForSolveResult,
  evaluateMove, applyMove, saveSession, getLessonDetail
} from "../../services/scheduleService";
import SectionPicker from "./SectionPicker";
import SolverProgress from "./SolverProgress";
import ConflictPanel from "./ConflictPanel";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const PERIODS = [
  { id: 1,  name: "Tiết 1",  time: "07:00-07:50" },
  { id: 2,  name: "Tiết 2",  time: "07:55-08:45" },
  { id: 3,  name: "Tiết 3",  time: "08:50-09:40" },
  { id: 4,  name: "Tiết 4",  time: "09:50-10:40" },
  { id: 5,  name: "Tiết 5",  time: "10:45-11:35" },
  { id: 6,  name: "Tiết 6",  time: "11:40-12:30" },
  { id: "break", name: "Nghỉ trưa", time: "12:30-13:00" },
  { id: 7,  name: "Tiết 7",  time: "13:00-13:50" },
  { id: 8,  name: "Tiết 8",  time: "13:55-14:45" },
  { id: 9,  name: "Tiết 9",  time: "14:50-15:40" },
  { id: 10, name: "Tiết 10", time: "15:50-16:40" },
  { id: 11, name: "Tiết 11", time: "16:45-17:35" },
  { id: 12, name: "Tiết 12", time: "17:40-18:30" },
];

const KNOWN_MAJORS = ["THKTM", "PTDLKD", "HTTTQL", "TDHVT", "GEN"];

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
  const gMap = new Map((schedule.studentGroups || []).map((g) => [g.id, g]));
  const tsMap = new Map((schedule.timeSlots || []).map((t) => [t.id, t]));

  return (schedule.lessons || []).map((lesson) => {
    const section = sectionMap.get(lesson.courseSectionId);
    const course = section ? courseMap.get(section.courseId) : null;
    // Multi-teacher: collect from sectionTeachers
    const sectionTeachers = (section?.sectionTeachers || []);
    const teacherNames = sectionTeachers.length > 0
      ? sectionTeachers.map(st => tMap.get(st.teacherId)?.name).filter(Boolean)
      : [];
    // Use sessionDuration directly from API
    const duration = lesson.sessionDuration || 1;
    // Primary student group from section
    const group = gMap.get(section?.studentGroupIds?.[0]);
    const ts = tsMap.get(lesson.timeSlotId);
    let slotId = null;
    if (assignSlots && ts && lesson.timeSlotId != null) {
      const di = mapDayIndex(ts.dayOfWeek);
      const pi = getPeriodIdFromTime(ts.startTime);
      slotId = di !== null && pi ? `${di}-${pi}` : null;
    }
    const courseName = course?.name || `Course ${lesson.courseSectionId}`;
    const sec = courseName.match(/HP\d+/i);
    const tn = teacherNames.join(", ") || "Chưa phân công";
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
      reqRoom: mapReqRoom(course?.requiredRoomType, course?.deliveryMode),
      cap: group?.size ?? 0,
      duration,
      sessionDuration: duration,
      major: inferMajor(courseName, group?.name),
      year,
      isShared,
      slotId,
      roomId: lesson.roomId || null,
      roomName: (schedule.rooms || []).find(r => r.id === lesson.roomId)?.name || null,
      isPinned: lesson.isPinned ?? false,
      isAutoPlaceFailed: lesson.isAutoPlaceFailed ?? false,
      courseSectionId: lesson.courseSectionId,
    };
  });
};



/* ─── Lesson Card ─── */
const LessonCard = memo(({
  lesson,
  variant = "grid",
  dragId,
  isHighlighted,
  hoveredLessonId,
  isHoverLoading,
  hoverDetails,
  onDragStart,
  onDragEnd,
  onRemove,
  onHover,
  onHoverLeave,
  totalCols
}) => {
  const cardRef = useRef(null);
  const [flipLeft, setFlipLeft] = useState(false);
  const [rect, setRect] = useState(null);

  const handleMouseEnter = () => {
    if (dragId !== null || window.event?.buttons === 1) return; // Không hiển thị thông tin chi tiết (hover detail) khi đang kéo thả
    if (cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      setRect(r);
      setFlipLeft(window.innerWidth - r.right < 450);
    }
    onHover(lesson.id);
  };

  const handleMouseLeave = () => {
    if (dragId !== null) return;
    onHoverLeave();
  };

  const cardClass = [
    "lesson-card",
    variant,
    lesson.isRequired ? "required" : "elective",
    lesson.isShared ? "shared" : "",
    dragId === lesson.id ? "dragging" : "",
    isHighlighted ? "highlighted" : "",
    lesson.isPinned ? "pinned" : "",
    totalCols > 1 ? `cols-${totalCols}` : "",
  ].filter(Boolean).join(" ");

  const isDragging = dragId === lesson.id;

  return (
    <div
      ref={cardRef}
      className={cardClass}
      draggable
      onDragStart={(e) => onDragStart(e, lesson.id)}
      onDragEnd={onDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="lesson-card-inner">
        <div className="lesson-head">
          <span className="lesson-major">{lesson.major}</span>
          <span className="lesson-section">{lesson.section}</span>
          {lesson.year && <span className={`lesson-year y${lesson.year}`}>Y{lesson.year}</span>}
          {lesson.isShared && <span className="lesson-shared-badge">CHUNG</span>}
          {lesson.isPinned && <span className="lesson-pin">[pin]</span>}
        </div>
        <strong>{lesson.name}</strong>
        {!isDragging && <span className="lesson-teacher">{lesson.teacher}</span>}
        {!isDragging && (
          <div className="lesson-meta">
            <span className="meta-room" title={`Yêu cầu: ${lesson.reqRoom}`}>{lesson.roomName || lesson.reqRoom}</span>
            <span className="meta-cap">{lesson.cap} SV</span>
            {lesson.duration > 1 && <span className="meta-duration">{lesson.duration} tiết</span>}
          </div>
        )}
      </div>
      {variant === "grid" && (
        <span className="lesson-remove" title="Gỡ khỏi lịch" onClick={() => onRemove(lesson.id)}>
          ×
        </span>
      )}
      {hoveredLessonId === lesson.id && !dragId && rect && createPortal(
        <div 
          className={`lesson-tooltip ${flipLeft ? "flip-left" : ""}`}
          onMouseEnter={() => onHover(lesson.id)}
          onMouseLeave={() => onHoverLeave()}
          style={{
            position: 'fixed',
            top: rect.top + rect.height / 2,
            left: flipLeft ? rect.left - 10 : rect.right + 10,
            transform: `translateY(-50%) ${flipLeft ? 'translateX(-100%)' : ''}`,
            zIndex: 99999,
            opacity: 1,
            visibility: 'visible',
            pointerEvents: 'auto'
          }}
        >
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
        <div className="tt-room-row">
          <span className="tt-label">Phòng đã xếp:</span>
          <span className="tt-val" style={{ fontWeight: lesson.roomName ? "bold" : "normal", color: lesson.roomName ? "#2563eb" : "inherit" }}>
            {lesson.roomName || "Chưa xếp"}
          </span>
        </div>

        <>
          <hr className="tt-divider" />
          {isHoverLoading && !hoverDetails[lesson.id] ? (
              <div className="tt-loading">
                <span className="tt-spinner" />
                <span>Đang tải chi tiết...</span>
              </div>
            ) : hoverDetails[lesson.id] ? (() => {
              const details = hoverDetails[lesson.id];
              return (
                <div className="tt-api-content">
                  {details.teacherNames && details.teacherNames.length > 0 && (
                    <div className="tt-row">
                      <span className="tt-label">Giảng viên thực tế:</span>
                      <span className="tt-val">{details.teacherNames.join(", ")}</span>
                    </div>
                  )}
                  {details.studentGroupNames && details.studentGroupNames.length > 0 && (
                    <div className="tt-row">
                      <span className="tt-label">Nhóm lớp thực tế:</span>
                      <span className="tt-val">{details.studentGroupNames.join(", ")}</span>
                    </div>
                  )}
                  <div className="tt-row">
                    <span className="tt-label">Phòng học thực tế:</span>
                    <span className="tt-val">{details.roomName || "Chưa xếp phòng"}</span>
                  </div>
                  <div className="tt-row">
                    <span className="tt-label">Thời gian thực tế:</span>
                    <span className="tt-val">{details.timeSlotLabel || "Chưa xếp lịch"}</span>
                  </div>
                  {details.teacherConditions && details.teacherConditions.length > 0 && (
                    <div className="tt-row" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                      <span className="tt-label" style={{ minWidth: 'auto', marginBottom: '2px' }}>Điều kiện giảng viên:</span>
                      {details.teacherConditions.map((cond, idx) => (
                        <span key={idx} className="tt-val" style={{ marginLeft: '8px', color: '#6366f1' }}>• {cond}</span>
                      ))}
                    </div>
                  )}

                  <div className="tt-conflicts-section">
                    <div className="tt-conflicts-title">Xung đột chi tiết</div>
                    {details.activeConflicts && details.activeConflicts.length > 0 ? (
                      <div className="tt-conflicts-list">
                        {details.activeConflicts.map((c) => {
                          let lvlClass = "soft";
                          let lvlLabel = "Gợi ý";
                          if (c.level === 0) {
                            lvlClass = "hard";
                            lvlLabel = "Nghiêm trọng";
                          } else if (c.level === 2) {
                            lvlClass = "warning";
                            lvlLabel = "Cảnh báo";
                          }
                          return (
                            <div key={c.id} className={`tt-conflict-item ${lvlClass}`}>
                              <span className="tt-conflict-bullet">•</span>
                              <span className="tt-conflict-desc" title={c.description}>
                                <strong>[{lvlLabel}]</strong> {c.description}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="tt-no-conflicts">✓ Không có xung đột</span>
                    )}
                  </div>
                </div>
              );
            })() : null}
          </>
        </div>,
        document.body
      )}
    </div>
  );
});

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
  const [hoverDetails, setHoverDetails] = useState({});
  const [hoveredLessonId, setHoveredLessonId] = useState(null);
  const [isHoverLoading, setIsHoverLoading] = useState(false);
  const showTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const isDraggingRef = useRef(false);

  const handleLessonHover = useCallback((lessonId) => {
    if (isDraggingRef.current || dragId) return;
    
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    showTimeoutRef.current = setTimeout(async () => {
      if (isDraggingRef.current || dragId) return;
      setHoveredLessonId(lessonId);
      const activeSession = sessionId || scenarioId;
      if (!activeSession) return;

      setIsHoverLoading(true);
      try {
        const detail = await getLessonDetail(activeSession, Number(lessonId));
        setHoverDetails((prev) => ({ ...prev, [lessonId]: detail }));
      } catch (err) {
        console.error("Lỗi lấy chi tiết lớp:", err);
      } finally {
        setIsHoverLoading(false);
      }
    }, 350); // Trì hoãn 350ms trước khi mở tooltip để người dùng kéo thẻ không bị kích hoạt tooltip che lưới
  }, [sessionId, scenarioId, dragId]);

  const handleLessonHoverLeave = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredLessonId(null);
    }, 200);
  }, []);

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
    isDraggingRef.current = true;
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    flushSync(() => {
      setHoveredLessonId(null);
      setDragId(lessonId);
    });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lessonId);
  }, []);

  const onDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    setDragId(null);
    setDragOver(null);
  }, []);

  const handleRemoveLesson = useCallback((id) => {
    setLessons((p) => p.map((l) => l.id === id ? { ...l, slotId: null, roomId: null, roomName: null } : l));
  }, []);

  const onCellDragOver = useCallback((e, slotKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(prev => prev !== slotKey ? slotKey : prev);
  }, []);

  const onCellDragLeave = useCallback(() => {
    setDragOver(prev => prev ? null : prev);
  }, []);

  const slotKeyToTimeSlot = useCallback((slotKey) => {
    if (!slotKey || !scheduleRaw?.timeSlots) return null;
    const [dayIdxStr, periodIdStr] = slotKey.split("-");
    const dayIdx = Number(dayIdxStr);
    const periodId = Number(periodIdStr);

    return scheduleRaw.timeSlots.find((ts) => {
      const di = mapDayIndex(ts.dayOfWeek);
      const pi = getPeriodIdFromTime(ts.startTime);
      return di === dayIdx && pi === periodId;
    });
  }, [scheduleRaw]);

  const onCellDrop = useCallback(async (e, slotKey) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (!id) return;
    setDragId(null);
    setDragOver(null);

    const activeSession = sessionId || scenarioId;
    if (!activeSession) {
      setLessons((prev) => prev.map((l) => l.id === id ? { ...l, slotId: slotKey } : l));
      if (scheduleState === "loaded") setScheduleState("manual");
      return;
    }

    const matchingSlot = slotKeyToTimeSlot(slotKey);
    if (!matchingSlot) {
      setLessons((prev) => prev.map((l) => l.id === id ? { ...l, slotId: slotKey } : l));
      if (scheduleState === "loaded") setScheduleState("manual");
      return;
    }

    try {
      const lessonToMove = lessons.find(l => String(l.id) === String(id));
      const initialRoomId = lessonToMove?.roomId || null;

      const result = await evaluateMove(activeSession, [{
        lessonId: Number(id),
        newTimeSlotId: matchingSlot.id,
        newRoomId: initialRoomId
      }]);

      setEvaluatePopup({
        lessonId: id,
        pendingSlot: slotKey,
        pendingTimeSlotId: matchingSlot.id,
        pendingRoomId: initialRoomId,
        result: result
      });
    } catch (err) {
      console.error("Evaluate move failed:", err);
      setLessons((prev) => prev.map((l) => l.id === id ? { ...l, slotId: slotKey } : l));
      if (scheduleState === "solved") setScheduleState("manual");
    }
  }, [dragId, sessionId, scenarioId, scheduleState, slotKeyToTimeSlot]);

  const onPanelDrop = useCallback(async (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (!id) return;
    setDragId(null);
    setDragOver(null);

    const activeSession = sessionId || scenarioId;
    if (!activeSession) {
      setLessons((prev) => prev.map((l) => l.id === id ? { ...l, slotId: null } : l));
      return;
    }

    try {
      const result = await evaluateMove(activeSession, [{
        lessonId: Number(id),
        newTimeSlotId: null,
        newRoomId: null
      }]);

      setEvaluatePopup({
        lessonId: id,
        pendingSlot: null,
        pendingTimeSlotId: null,
        pendingRoomId: null,
        result: result
      });
    } catch (err) {
      console.error("Evaluate unassign failed:", err);
      setLessons((prev) => prev.map((l) => l.id === id ? { ...l, slotId: null } : l));
    }
  }, [dragId, sessionId, scenarioId]);

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
    if (pid === "break") return 8;
    const p = Number(pid);
    return p <= 6 ? p + 1 : p + 2;
  };

  const stateMap = {
    empty: { text: "Chua co du lieu", cls: "state-empty", icon: "" },
    loaded: { text: "Da tai – Cho xep lich", cls: "state-loaded", icon: "" },
    manual: { text: "Dang xep tay", cls: "state-manual", icon: "" },
    solved: { text: "Da xep xong", cls: "state-solved", icon: "" },
  };
  const st = stateMap[scheduleState] || stateMap.empty;



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
            <div className="ep-title">Đánh giá di chuyển</div>
            <div className="ep-scores">
              <div className="ep-score">
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginBottom: '2px' }}>Hard Cũ</div>
                <div>{evaluatePopup.result?.oldHardScore ?? 0}</div>
              </div>
              <div className="ep-score">
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginBottom: '2px' }}>Hard Mới</div>
                <div>{evaluatePopup.result?.newHardScore ?? 0}</div>
              </div>
              <div className={`ep-score ${(evaluatePopup.result?.hardScoreDelta ?? 0) < 0 ? "bad" : "good"}`}>
                <div style={{ fontSize: '11px', fontWeight: 'normal', marginBottom: '2px' }}>Thay đổi (δ)</div>
                <div>{(evaluatePopup.result?.hardScoreDelta ?? 0) > 0 ? `+${evaluatePopup.result.hardScoreDelta}` : evaluatePopup.result?.hardScoreDelta ?? 0}</div>
              </div>
            </div>
            {evaluatePopup.result?.addedConflicts?.length > 0 && (
              <div className="ep-conflicts">Thêm {evaluatePopup.result.addedConflicts.length} xung đột mới</div>
            )}
            {evaluatePopup.result?.resolvedConflicts?.length > 0 && (
              <div className="ep-resolved">Giải quyết {evaluatePopup.result.resolvedConflicts.length} xung đột</div>
            )}
            {(() => {
              let suggestedRooms = [];
              let otherRooms = [];
              let busyRooms = [];
              
              if (evaluatePopup.pendingSlot) {
                const targetLesson = lessons.find(l => String(l.id) === String(evaluatePopup.lessonId));
                const targetDay = Number(evaluatePopup.pendingSlot.split("-")[0]);
                const targetPeriod = Number(evaluatePopup.pendingSlot.split("-")[1]);
                const targetDur = targetLesson?.duration || 1;
                
                const busyIds = new Set();
                lessons.forEach(l => {
                  if (String(l.id) === String(evaluatePopup.lessonId)) return;
                  if (!l.slotId) return;
                  const d = Number(l.slotId.split("-")[0]);
                  const p = Number(l.slotId.split("-")[1]);
                  const dur = l.duration || 1;
                  if (d === targetDay && p < targetPeriod + targetDur && (p + dur) > targetPeriod) {
                    if (l.roomId) busyIds.add(l.roomId);
                  }
                });

                (scheduleRaw?.rooms || []).forEach(r => {
                  if (busyIds.has(r.id)) {
                    busyRooms.push(r);
                  } else {
                    const hasCap = targetLesson ? r.capacity >= targetLesson.cap : true;
                    let isType = true;
                    if (targetLesson?.reqRoom === "Lab") {
                      isType = r.roomType === 1 || r.name.toLowerCase().includes("thực hành") || r.name.toLowerCase().includes("lab");
                    } else if (targetLesson?.reqRoom === "Theory") {
                      isType = r.roomType === 0 && !r.name.toLowerCase().includes("thực hành") && !r.name.toLowerCase().includes("lab");
                    }
                    
                    if (hasCap && isType) suggestedRooms.push(r);
                    else otherRooms.push(r);
                  }
                });
              } else {
                otherRooms = scheduleRaw?.rooms || [];
              }

              return (
                <div className="ep-room-select" style={{ marginTop: '10px', marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Phòng học gợi ý:</label>
                  <select 
                    value={evaluatePopup.pendingRoomId || ""} 
                    onChange={async (e) => {
                      const newRoomId = e.target.value ? Number(e.target.value) : null;
                      setEvaluatePopup(prev => ({ ...prev, pendingRoomId: newRoomId }));
                      try {
                        const result = await evaluateMove(sessionId || scenarioId, [{
                          lessonId: Number(evaluatePopup.lessonId),
                          newTimeSlotId: evaluatePopup.pendingTimeSlotId,
                          newRoomId: newRoomId
                        }]);
                        setEvaluatePopup(prev => ({ ...prev, result: result }));
                      } catch (err) {
                        console.error("Evaluate room change failed:", err);
                      }
                    }}
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="">-- Chưa gán phòng (Online) --</option>
                    {suggestedRooms.length > 0 && (
                      <optgroup label="✨ Phù hợp & Trống">
                        {suggestedRooms.map(r => (
                          <option key={r.id} value={r.id}>{r.name} (Sức chứa: {r.capacity})</option>
                        ))}
                      </optgroup>
                    )}
                    {otherRooms.length > 0 && (
                      <optgroup label="Trống (Không đạt yêu cầu)">
                        {otherRooms.map(r => (
                          <option key={r.id} value={r.id}>{r.name} (Sức chứa: {r.capacity})</option>
                        ))}
                      </optgroup>
                    )}
                    {busyRooms.length > 0 && (
                      <optgroup label="⚠️ Đang bận (Xung đột)">
                        {busyRooms.map(r => (
                          <option key={r.id} value={r.id}>{r.name} (Sức chứa: {r.capacity})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              );
            })()}
            <div className="ep-actions">
              <button className="ep-btn confirm" onClick={async () => {
                const activeSession = sessionId || scenarioId;
                let res = null;
                if (activeSession) {
                  try {
                    res = await applyMove(activeSession, [{
                      lessonId: Number(evaluatePopup.lessonId),
                      newTimeSlotId: evaluatePopup.pendingTimeSlotId,
                      newRoomId: evaluatePopup.pendingRoomId
                    }]);
                  } catch (err) {
                    console.error("Apply move failed:", err);
                    alert("Không thể áp dụng thay đổi lên Server. Vui lòng thử lại!");
                    return;
                  }
                }

                setLessons((prev) => prev.map((l) => l.id === evaluatePopup.lessonId ? { 
                  ...l, 
                  slotId: evaluatePopup.pendingSlot,
                  roomId: evaluatePopup.pendingRoomId,
                  roomName: (scheduleRaw?.rooms || []).find(r => r.id === evaluatePopup.pendingRoomId)?.name || null
                } : l));
                if (scheduleState === "solved") setScheduleState("manual");
                
                // Cập nhật conflicts tăng giảm tăng độ mượt UX
                if (res && res.conflicts) {
                  setConflicts(res.conflicts);
                }
                if (res && res.newHardScore !== undefined) {
                  setApiScore(prev => ({ ...prev, hard: res.newHardScore, soft: res.newSoftScore || 0 }));
                }
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
              unassignedLessons.map((l) => (
                <LessonCard
                  key={l.id}
                  lesson={l}
                  variant="pending"
                  dragId={dragId}
                  isHighlighted={highlightedIds.has(Number(l.id))}
                  hoveredLessonId={hoveredLessonId}
                  isHoverLoading={isHoverLoading}
                  hoverDetails={hoverDetails}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onRemove={handleRemoveLesson}
                  onHover={handleLessonHover}
                  onHoverLeave={handleLessonHoverLeave}
                />
              ))
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
                Rows: row 1 = header, rows 2-7 = Tiết 1-6, row 8 = break, rows 9-14 = Tiết 7-12 */}
            <div className="schedv2-grid-table"
              style={{
                gridTemplateColumns: "70px repeat(6, 1fr)",
                gridTemplateRows: "36px repeat(6, 60px) 30px repeat(6, 60px)"
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
                // Grid rows: row1=header(36px), rows2-7=periods1-6(60px each),
                //            row8=break(30px), rows9-14=periods7-12(60px each)
                const ROW_H = 60;
                const BREAK_H = 30;
                const HEADER_H = 36;
                // Total height of the "day body" area (excluding header)
                const TOTAL_H = 6 * ROW_H + BREAK_H + 6 * ROW_H; // 6+break+6 rows

                // Convert period id → top offset in px from start of day body
                const periodToTop = (pid) => {
                  if (pid >= 1 && pid <= 6) return (pid - 1) * ROW_H;
                  if (pid >= 7 && pid <= 12) return 6 * ROW_H + BREAK_H + (pid - 7) * ROW_H;
                  return 0;
                };

                return Object.entries(byDay).map(([diStr, dayLessons]) => {
                  const di = Number(diStr);
                  const hasHovered = hoveredLessonId && dayLessons.some(l => String(l.id) === String(hoveredLessonId));
                  return (
                    <div key={`day-host-${di}`}
                      className={`schedv2-day-host ${di === 5 ? "sat" : ""}`}
                      style={{
                        gridRow: `2 / 15`, // span all period rows (rows 2-14)
                        gridColumn: di + 2,
                        position: "relative",
                        height: TOTAL_H,
                        pointerEvents: "none", // drop targets still below
                        zIndex: hasHovered ? 10 : 3,
                      }}>
                      {dayLessons.map((lesson) => {
                        const pid = Number(lesson.slotId.split("-")[1]);
                        const dur = lesson.duration || 1;
                        const layout = dayLayoutMap[lesson.id] || { colIndex: 0, totalCols: 1 };
                        const { colIndex, totalCols } = layout;

                        const top = periodToTop(pid);
                        // Height: sum of period heights covered, including break if spans it
                        let heightPx = 0;
                        for (let p = 0; p < dur; p++) {
                          const curPid = pid + p;
                          heightPx += ROW_H;
                          // If this period is period 6 and next would cross into afternoon, add break
                          if (curPid === 6 && p < dur - 1) heightPx += BREAK_H;
                        }

                        const GAP = 2; // px gap between side-by-side lessons
                        const widthPct = 100 / totalCols;
                        const leftPct = colIndex * widthPct;

                        const isHoveredCard = hoveredLessonId === lesson.id;
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
                              zIndex: isHoveredCard ? 50 : 4,
                              padding: "2px",
                              boxSizing: "border-box",
                              overflow: "visible",
                            }}
                            onDragOver={(e) => onCellDragOver(e, lesson.slotId)}
                            onDragLeave={onCellDragLeave}
                            onDrop={(e) => onCellDrop(e, lesson.slotId)}>
                            <LessonCard
                              lesson={lesson}
                              variant="grid"
                              dragId={dragId}
                              isHighlighted={highlightedIds.has(Number(lesson.id))}
                              hoveredLessonId={hoveredLessonId}
                              isHoverLoading={isHoverLoading}
                              hoverDetails={hoverDetails}
                              onDragStart={onDragStart}
                              onDragEnd={onDragEnd}
                              onRemove={handleRemoveLesson}
                              onHover={handleLessonHover}
                              onHoverLeave={handleLessonHoverLeave}
                              totalCols={totalCols}
                            />
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
