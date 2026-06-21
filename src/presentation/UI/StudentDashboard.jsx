import { useState, useEffect } from "react";
import { getProfile, getMySchedules, getMyScheduleDetail } from "../../services/studentService";
import PeriodTimetable from "./PeriodTimetable";

export default function StudentDashboard({ user, language }) {
  const isVi = language === "Vietnamese";
  const [profile, setProfile] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [prof, schList] = await Promise.all([getProfile(), getMySchedules()]);
        setProfile(prof);
        const list = schList?.schedules || [];
        setSchedules(list);
        if (list.length > 0) setSelectedId(list[0].scheduleId);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    (async () => {
      setLoading(true);
      try {
        const d = await getMyScheduleDetail(selectedId);
        setDetail(d);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedId]);

  return (
    <div className="student-dashboard">
      {/* ═══ Profile Card ═══ */}
      <div className="profile-card student-profile">
        <div className="profile-avatar">🎓</div>
        <div className="profile-info">
          <h2>{profile?.name || user?.name || "—"}</h2>
          <div className="profile-meta">
            <span className="profile-badge student-badge">
              {profile?.studentCode || "—"}
            </span>
            <span className="profile-detail">
              {isVi ? "Lớp" : "Class"}: <strong>{profile?.studentGroupName || "—"}</strong>
            </span>
            {profile?.majorName && profile.majorName !== "N/A" && (
              <span className="profile-detail">
                {isVi ? "Ngành" : "Major"}: <strong>{profile.majorName}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Header ═══ */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <span className="dashboard-icon">📚</span>
          <div>
            <h3>{isVi ? "Lịch học của tôi" : "My Class Schedule"}</h3>
            <p className="dashboard-subtitle">
              {detail ? `${detail.scheduleName || ""}` : (isVi ? "Chọn lịch để xem" : "Select a schedule")}
            </p>
          </div>
        </div>
        <div className="dashboard-controls">
          {schedules.length > 0 && (
            <select
              className="dashboard-select"
              value={selectedId || ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
            >
              {schedules.map((s) => (
                <option key={s.scheduleId} value={s.scheduleId}>
                  {s.name} {s.semesterName ? `(${s.semesterName})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ═══ Messages ═══ */}
      {error && <div className="dashboard-msg error">{error}</div>}
      {loading && <div className="dashboard-msg">{isVi ? "Đang tải..." : "Loading..."}</div>}

      {/* ═══ Period Timetable ═══ */}
      {!loading && detail && (
        <>
          <PeriodTimetable
            lessons={detail.lessons || []}
            role="student"
            language={language}
          />
          <div className="dashboard-scores">
            <span className="score-pill">
              {isVi ? "Số buổi" : "Lessons"}: {detail.lessons?.length ?? 0}
            </span>
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !detail && schedules.length === 0 && (
        <div className="dashboard-empty">
          <span className="empty-icon">📭</span>
          <p>{isVi ? "Chưa có lịch học nào được công bố." : "No published schedule available."}</p>
        </div>
      )}
    </div>
  );
}
