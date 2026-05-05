import { useState } from "react";
import { rooms, timeSlots, courses } from "../../data";
import { solveSchedule, transformToApiFormat } from "../../services/scheduleService";
import { RoomTypeLabels, DeliveryModeLabels } from "../../constants/enums";

export default function SchedulingSystem() {
  const [assignments, setAssignments] = useState({});
  const [isSolving, setIsSolving] = useState(false);
  const [solveMessage, setSolveMessage] = useState(null);
  const [apiScore, setApiScore] = useState(null);

  // Build cell lookup: key = "timeSlotId-roomId" → course object
  const cellLookup = {};
  for (const [cid, a] of Object.entries(assignments)) {
    cellLookup[`${a.timeSlotId}-${a.roomId}`] = courses.find((c) => c.id === cid);
  }

  const assignedIds = new Set(Object.keys(assignments));
  const unscheduled = courses.filter((c) => !assignedIds.has(c.id));

  /* ─── Gọi API để xếp lịch ─── */
  const handleSolve = async () => {
    setIsSolving(true);
    setSolveMessage(null);
    setApiScore(null);
    try {
      const { request, reverseRoomMap, reverseSlotMap, lessonCourseMap } = 
        transformToApiFormat("scenario-" + Date.now(), rooms, timeSlots, courses);
      
      const result = await solveSchedule(request);
      
      if (result && result.schedule && result.schedule.lessons) {
        const newAssignments = {};
        result.schedule.lessons.forEach(lesson => {
          if (lesson.roomId && lesson.timeSlotId) {
            const courseId = lessonCourseMap[lesson.id];
            const roomId = reverseRoomMap[lesson.roomId];
            const timeSlotId = reverseSlotMap[lesson.timeSlotId];
            if (courseId && roomId && timeSlotId) {
              newAssignments[courseId] = { timeSlotId, roomId };
            }
          }
        });
        setAssignments(newAssignments);
        
        const hScore = result.schedule.hardScore ?? result.hardScore ?? 0;
        const sScore = result.schedule.softScore ?? result.softScore ?? 0;
        setApiScore({ hard: hScore, soft: sScore });
        setSolveMessage({ 
          type: hScore === 0 ? "success" : "error", 
          text: hScore === 0 
            ? `✅ Lập lịch thành công! Không vi phạm ràng buộc cứng.` 
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
          <button 
            className="btn-solve" 
            onClick={handleSolve} 
            disabled={isSolving} 
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
        {Object.keys(assignments).length > 0 && unscheduled.length === 0 ? (
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
