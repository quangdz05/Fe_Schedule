import { useState, useEffect } from "react";
import { getScheduleList, publishSchedule, archiveSchedule } from "../../services/scheduleService";

const STATUS_MAP = {
  Draft:     { label: "Nháp",      cls: "draft",     icon: "📝" },
  Solving:   { label: "Đang xếp",  cls: "solving",   icon: "⏳" },
  Review:    { label: "Xem xét",   cls: "review",    icon: "🔍" },
  Published: { label: "Đã công bố", cls: "published", icon: "✅" },
  Archived:  { label: "Lưu trữ",   cls: "archived",  icon: "📦" },
};

export default function ScheduleListManager({ language, onOpenSchedule }) {
  const isVi = language === "Vietnamese";
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getScheduleList();
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePublish = async (id) => {
    setActionMsg(null);
    try {
      await publishSchedule(id);
      setActionMsg({ type: "success", text: `Lịch #${id} đã được công bố.` });
      await load();
    } catch (err) {
      setActionMsg({ type: "error", text: err.message });
    }
  };

  const handleArchive = async (id) => {
    setActionMsg(null);
    try {
      await archiveSchedule(id);
      setActionMsg({ type: "success", text: `Lịch #${id} đã được lưu trữ.` });
      await load();
    } catch (err) {
      setActionMsg({ type: "error", text: err.message });
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="schedule-list-page">
      <div className="semester-header">
        <div className="dashboard-title">
          <span className="dashboard-icon">📋</span>
          <div>
            <h3>{isVi ? "Quản lý lịch đã lưu" : "Saved Schedules"}</h3>
            <p className="dashboard-subtitle">
              {isVi ? "Xem, chỉnh sửa, công bố hoặc lưu trữ" : "View, edit, publish or archive"}
            </p>
          </div>
        </div>
        <button className="cf-submit" onClick={load}>
          🔄 {isVi ? "Tải lại" : "Refresh"}
        </button>
      </div>

      {error && <div className="dashboard-msg error">{error}</div>}
      {actionMsg && <div className={`dashboard-msg ${actionMsg.type}`}>{actionMsg.text}</div>}
      {loading && <div className="dashboard-msg">{isVi ? "Đang tải..." : "Loading..."}</div>}

      {!loading && (
        <div className="semester-table-wrap">
          <table className="semester-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{isVi ? "Tên" : "Name"}</th>
                <th>{isVi ? "Trạng thái" : "Status"}</th>
                <th>{isVi ? "Số buổi" : "Lessons"}</th>
                <th>Hard</th>
                <th>Soft</th>
                <th>{isVi ? "Tạo lúc" : "Created"}</th>
                <th>{isVi ? "Công bố" : "Published"}</th>
                <th>{isVi ? "Thao tác" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                    {isVi ? "Chưa có lịch nào được lưu." : "No schedules saved."}
                  </td>
                </tr>
              ) : (
                schedules.map((s) => {
                  const st = STATUS_MAP[s.status] || STATUS_MAP.Draft;
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.id}</strong></td>
                      <td>{s.name || <span style={{ color: "#94a3b8" }}>Chưa đặt tên</span>}</td>
                      <td>
                        <span className={`semester-badge ${st.cls}`}>
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>{s.lessonCount}</td>
                      <td style={{ textAlign: "center", color: s.hardScore === 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                        {s.hardScore}
                      </td>
                      <td style={{ textAlign: "center" }}>{s.softScore}</td>
                      <td style={{ fontSize: "12px" }}>{formatDate(s.createdAtUtc)}</td>
                      <td style={{ fontSize: "12px" }}>{formatDate(s.publishedAtUtc)}</td>
                      <td>
                        <div className="schedule-actions">
                          {onOpenSchedule && (
                            <button
                              className="ci-edit-btn"
                              onClick={() => onOpenSchedule(s.id)}
                              title={isVi ? "Mở trong trình xếp lịch" : "Open in scheduler"}
                            >
                              ✏️ {isVi ? "Sửa" : "Edit"}
                            </button>
                          )}
                          {s.status !== "Published" && (
                            <button
                              className="ci-edit-btn publish-btn"
                              onClick={() => handlePublish(s.id)}
                            >
                              🚀 {isVi ? "Công bố" : "Publish"}
                            </button>
                          )}
                          {s.status !== "Archived" && (
                            <button
                              className="ci-edit-btn archive-btn"
                              onClick={() => handleArchive(s.id)}
                            >
                              📦 {isVi ? "Lưu trữ" : "Archive"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
