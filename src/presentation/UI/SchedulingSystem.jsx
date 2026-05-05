import { useState } from "react";
import { getScheduleResult, solveSchedule } from "../../services/scheduleService";
import { RoomTypeLabels, DeliveryModeLabels } from "../../constants/enums";

export default function SchedulingSystem() {
  const [rooms, setRooms] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [courses, setCourses] = useState([]);
  const [scheduleRaw, setScheduleRaw] = useState(null);
  const [scenarioId, setScenarioId] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataMessage, setDataMessage] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [isSolving, setIsSolving] = useState(false);
  const [solveMessage, setSolveMessage] = useState(null);
  const [apiScore, setApiScore] = useState(null);

  const dayLabels = {
    0: "Chủ Nhật",
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
  };

  const formatTime = (value) => {
    if (!value) return "";
    const raw = String(value);
    const timePart = raw.includes("T") ? raw.split("T")[1] : raw;
    return timePart.slice(0, 5);
  };

  const inferShift = (timeValue) => {
    const hour = Number(String(timeValue || "0").slice(0, 2));
    return hour < 12 ? "Sáng" : "Chiều";
  };

  const applyScheduleData = (schedule) => {
    if (!schedule) return;

    const teacherMap = new Map((schedule.teachers || []).map((t) => [t.id, t]));
    const subjectMap = new Map((schedule.subjects || []).map((s) => [s.id, s]));
    const groupMap = new Map((schedule.studentGroups || []).map((g) => [g.id, g]));

    const uiRooms = (schedule.rooms || []).map((room) => ({
      id: room.id,
      name: room.name || `Phòng ${room.id}`,
      capacity: room.capacity ?? 0,
      roomType: room.roomType ?? 0,
      deliveryMode: 0,
      icon: room.name && String(room.name).toLowerCase().includes("zoom") ? "🌐" : "🏫",
    }));

    const uiTimeSlots = (schedule.timeSlots || []).map((slot) => {
      const startTime = formatTime(slot.startTime);
      const endTime = formatTime(slot.endTime);
      const timeRange = startTime && endTime ? `${startTime}-${endTime}` : "";
      return {
        id: slot.id,
        day: dayLabels[slot.dayOfWeek] || "Thứ 2",
        shift: inferShift(startTime),
        time: timeRange,
      };
    });

    const uiCourses = (schedule.lessons || []).map((lesson) => {
      const teacher = teacherMap.get(lesson.teacherId);
      const subject = subjectMap.get(lesson.subjectId);
      const group = groupMap.get(lesson.studentGroupId);
      return {
        id: String(lesson.id),
        name: subject?.name || `Môn ${lesson.subjectId}`,
        lecturer: teacher?.name || `GV ${lesson.teacherId}`,
        lecturerIcon: "👨‍🏫",
        classGroup: group?.name || `Lớp ${lesson.studentGroupId}`,
        students: group?.size ?? 0,
        requiredRoomType: lesson.requiredRoomType ?? subject?.requiredRoomType ?? 0,
        deliveryMode: lesson.deliveryMode ?? 0,
      };
    });

    const newAssignments = {};
    (schedule.lessons || []).forEach((lesson) => {
      if (lesson.roomId != null && lesson.timeSlotId != null) {
        newAssignments[String(lesson.id)] = {
          timeSlotId: lesson.timeSlotId,
          roomId: lesson.roomId,
        };
      }
    });

    setRooms(uiRooms);
    setTimeSlots(uiTimeSlots);
    setCourses(uiCourses);
    setAssignments(newAssignments);
    setScheduleRaw(schedule);

    const hScore = schedule.hardScore ?? 0;
    const sScore = schedule.softScore ?? 0;
    if (schedule.lessons && schedule.lessons.length > 0) {
      setApiScore({ hard: hScore, soft: sScore });
    }
  };

  // Build cell lookup: key = "timeSlotId-roomId" → course object
  const cellLookup = {};
  for (const [cid, a] of Object.entries(assignments)) {
    cellLookup[`${a.timeSlotId}-${a.roomId}`] = courses.find((c) => c.id === cid);
  }

  const assignedIds = new Set(Object.keys(assignments));
  const unscheduled = courses.filter((c) => !assignedIds.has(c.id));

  const handleLoad = async () => {
    const trimmedId = scenarioId.trim();
    if (!trimmedId) {
      setDataMessage({ type: "error", text: "Vui lòng nhập scenarioId để tải dữ liệu." });
      return;
    }

    setIsLoadingData(true);
    setDataMessage(null);
    setSolveMessage(null);
    try {
      const result = await getScheduleResult(trimmedId);
      const schedule = result?.schedule || result;

      if (!schedule || !schedule.lessons) {
        throw new Error("API không trả về dữ liệu hợp lệ.");
      }

      applyScheduleData(schedule);
      if (result?.scenarioId) {
        setScenarioId(result.scenarioId);
      }
      setDataMessage({ type: "success", text: "Đã tải dữ liệu từ API." });
    } catch (err) {
      setDataMessage({ type: "error", text: `Lỗi tải dữ liệu: ${err.message}` });
    } finally {
      setIsLoadingData(false);
    }
  };

  /* ─── Gọi API để xếp lịch ─── */
  const handleSolve = async () => {
    if (!scheduleRaw) {
      setSolveMessage({ type: "error", text: "Chưa có dữ liệu. Vui lòng tải dữ liệu trước." });
      return;
    }

    const trimmedId = scenarioId.trim() || `scenario-${Date.now()}`;

    setIsSolving(true);
    setSolveMessage(null);
    setApiScore(null);
    try {
      const request = {
        scenarioId: trimmedId,
        schedule: scheduleRaw,
        saveScenario: true,
        saveResult: true,
      };

      const result = await solveSchedule(request);
      const schedule = result?.schedule || result;

      if (schedule && schedule.lessons) {
        applyScheduleData(schedule);

        const hScore = schedule.hardScore ?? result?.hardScore ?? 0;
        const sScore = schedule.softScore ?? result?.softScore ?? 0;
        setApiScore({ hard: hScore, soft: sScore });
        setSolveMessage({
          type: hScore === 0 ? "success" : "error",
          text: hScore === 0
            ? "✅ Lập lịch thành công! Không vi phạm ràng buộc cứng."
            : `⚠️ Lập lịch hoàn tất nhưng còn ${Math.abs(hScore)} vi phạm ràng buộc cứng.`
        });
      } else {
        setSolveMessage({ type: "error", text: "API không trả về kết quả hợp lệ." });
      }
    } catch (err) {
      setSolveMessage({ type: "error", text: `Lỗi kết nối: ${err.message}` });
    } finally {
      setIsSolving(false);
    }
  };

  const reset = () => { 
    setAssignments({}); 
    setSolveMessage(null); 
    setApiScore(null); 
  };

  return (
    <div className="scheduling-system">
      {/* ─── Header ─── */}
      <div className="sched-header-card">
        <h2 className="sched-title">Lập lịch tự động</h2>
        <p className="sched-subtitle">
          Dữ liệu được gửi lên Server để tối ưu hóa bằng thuật toán AI
        </p>

        <div className="sched-action-bar">
          <div className="sched-load">
            <input
              className="sched-input"
              type="text"
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              placeholder="Scenario ID"
            />
            <button
              className="btn-reset"
              type="button"
              onClick={handleLoad}
              disabled={isLoadingData}
            >
              {isLoadingData ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <button 
            className="btn-solve" 
            onClick={handleSolve} 
            disabled={isSolving || !scheduleRaw} 
            id="btn-auto-solve"
            style={{ 
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", 
              color: "white", border: "none", padding: "12px 28px", 
              borderRadius: "8px", fontWeight: 600, cursor: isSolving ? "not-allowed" : "pointer", 
              fontSize: "1rem", opacity: isSolving ? 0.7 : 1,
              transition: "all 0.2s ease"
            }}>
            {isSolving ? <><span className="spinner" /> Đang xếp lịch...</> : <>🚀 Lập lịch tự động</>}
          </button>

          {Object.keys(assignments).length > 0 && (
            <button 
              className="btn-reset" 
              onClick={reset} 
              id="btn-reset"
              style={{ 
                background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", 
                padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem" 
              }}>
              Xóa lịch
            </button>
          )}
        </div>
      </div>

      {/* ─── Messages ─── */}
      {solveMessage && (
        <div className={`solve-msg ${solveMessage.type}`}>{solveMessage.text}</div>
      )}
      {dataMessage && (
        <div className={`solve-msg ${dataMessage.type}`}>{dataMessage.text}</div>
      )}
      {apiScore && (
        <div style={{ 
          display: "flex", gap: "12px", justifyContent: "center", 
          marginBottom: "16px", flexWrap: "wrap" 
        }}>
          <span style={{ 
            padding: "6px 14px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 500,
            background: apiScore.hard === 0 ? "#dcfce7" : "#fee2e2",
            color: apiScore.hard === 0 ? "#166534" : "#991b1b"
          }}>
            Hard Score: {apiScore.hard}
          </span>
          <span style={{ 
            padding: "6px 14px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 500,
            background: "#eff6ff", color: "#1e40af"
          }}>
            Soft Score: {apiScore.soft}
          </span>
          <span style={{ 
            padding: "6px 14px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 500,
            background: "#f5f3ff", color: "#6d28d9"
          }}>
            Đã xếp: {Object.keys(assignments).length}/{courses.length} môn
          </span>
        </div>
      )}

      {/* ─── Schedule Grid (chỉ hiển thị, không cho kéo thả) ─── */}
      <div className="grid-card">
        <div className="grid-scroll">
          <table className="sched-grid" id="schedule-grid">
            <thead>
              <tr>
                <th className="th-slot">Khung giờ</th>
                {rooms.map((r) => (
                  <th key={r.id} className="th-room">
                    <div className="room-hdr">
                      <span className="room-icon">{r.icon}</span>
                      <span className="room-name">{r.name}</span>
                    </div>
                    <div className="room-meta">
                      <span className="room-cap">Sức chứa: {r.capacity}</span>
                      <span className={`room-badge type-${r.roomType}`}>
                        {RoomTypeLabels[r.roomType]}
                      </span>
                      <span className={`room-badge mode-${r.deliveryMode}`}>
                        {DeliveryModeLabels[r.deliveryMode]}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => (
                <tr key={slot.id}>
                  <td className="td-slot">
                    <div className="slot-day">{slot.day}</div>
                    <div className="slot-shift">{slot.shift} ({slot.time})</div>
                  </td>
                  {rooms.map((room) => {
                    const ck = `${slot.id}-${room.id}`;
                    const course = cellLookup[ck];

                    return (
                      <td key={ck} className="td-cell" id={`cell-${ck}`}>
                        {course ? (
                          <div className="placed-course">
                            <div className="placed-name">{course.name}</div>
                            <div className="placed-info">{course.lecturerIcon} {course.lecturer}</div>
                            <div className="placed-info">
                              <span>👥 {course.classGroup}</span>
                              <span className="placed-sv">{course.students} SV</span>
                            </div>
                            <div className="tag-container">
                              <span className={`tag-sm mode-${course.deliveryMode}`}>{DeliveryModeLabels[course.deliveryMode]}</span>
                              <span className={`tag-sm type-${course.requiredRoomType}`}>{RoomTypeLabels[course.requiredRoomType]}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="empty-cell" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Danh sách môn học ─── */}
      <div className="unscheduled-card">
        <div className="card-hdr">
          <h3>{Object.keys(assignments).length > 0 ? "Chưa được xếp" : "Danh sách môn học"}</h3>
          <span className="count-badge">{unscheduled.length > 0 ? unscheduled.length : courses.length}</span>
        </div>
        {courses.length === 0 ? (
          <div className="all-done">Vui lòng tải dữ liệu để hiển thị danh sách môn.</div>
        ) : Object.keys(assignments).length > 0 && unscheduled.length === 0 ? (
          <div className="all-done">✅ Tất cả môn đã được xếp lịch!</div>
        ) : (
          <div className="course-list">
            {(Object.keys(assignments).length > 0 ? unscheduled : courses).map((c) => (
              <div key={c.id} className="course-card" id={`course-${c.id}`}>
                <div className="cc-top">
                  <h4 className="cc-name">{c.name}</h4>
                  <div className="tag-container">
                    <span className={`tag mode-${c.deliveryMode}`}>{DeliveryModeLabels[c.deliveryMode]}</span>
                    <span className={`tag type-${c.requiredRoomType}`}>{RoomTypeLabels[c.requiredRoomType]}</span>
                  </div>
                </div>
                <div className="cc-row">{c.lecturerIcon} {c.lecturer}</div>
                <div className="cc-row">
                  <span>👥 {c.classGroup}</span>
                  <span className="cc-sv">{c.students} SV</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Legend ─── */}
      <div className="legend-card">
        <h3>Các ràng buộc (xử lý bởi Server)</h3>
        <div className="legend-grid">
          <div className="legend-item"><span className="lg-icon">🏫</span><div><strong>Sức chứa phòng</strong><p>Số sinh viên ≤ sức chứa phòng</p></div></div>
          <div className="legend-item"><span className="lg-icon">🔄</span><div><strong>Loại phòng & Hình thức</strong><p>Phải khớp cả Loại (Lý thuyết/TH) và Hình thức (Trực tiếp/Online)</p></div></div>
          <div className="legend-item"><span className="lg-icon">👨‍🏫</span><div><strong>Không trùng GV</strong><p>1 GV không dạy 2 môn cùng khung giờ</p></div></div>
          <div className="legend-item"><span className="lg-icon">👥</span><div><strong>Không trùng lớp</strong><p>1 lớp không học 2 môn cùng khung giờ</p></div></div>
        </div>
      </div>
    </div>
  );
}
