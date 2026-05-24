import { useState } from "react";
import { getScheduleResult } from "../../services/scheduleService";
import { DeliveryModeLabels } from "../../constants/enums";

export default function GradeForm({ user, language = "English" }) {
  const [selectedCohort, setSelectedCohort] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [courses, setCourses] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isVi = language === "Vietnamese";

  const t = {
    student: isVi ? "Giảng viên *" : "Lecturer *",
    cohort: isVi ? "Khóa *" : "Cohort *",
    selectCohort: isVi ? "Chọn khóa..." : "Select cohort...",
    unknownStudent: isVi ? "Không rõ giảng viên" : "Unknown Lecturer",
    scheduleList: isVi ? "Danh sách giảng dạy" : "Teaching Schedule",
    courseCol: isVi ? "Môn học" : "Course",
    lecturerCol: isVi ? "Giảng viên" : "Lecturer",
    modeCol: isVi ? "Hình thức" : "Mode",
    classCol: isVi ? "Lớp" : "Class",
    scenario: isVi ? "Scenario ID" : "Scenario ID",
    load: isVi ? "Tải dữ liệu" : "Load data",
    loadError: isVi ? "Vui lòng nhập scenarioId." : "Please enter scenarioId.",
    noData: isVi ? "Chưa có dữ liệu giảng dạy cho lựa chọn này." : "No teaching data for this selection."
  };

  const cohorts = ["VJU2022", "VJU2023", "VJU2024", "VJU2025"];

  const mapScheduleToCourses = (schedule) => {
    const teacherMap = new Map((schedule?.teachers || []).map((t) => [t.id, t]));
    const subjectMap = new Map((schedule?.subjects || []).map((s) => [s.id, s]));
    const groupMap = new Map((schedule?.studentGroups || []).map((g) => [g.id, g]));

    return (schedule?.lessons || []).map((lesson) => {
      const teacher = teacherMap.get(lesson.teacherId);
      const subject = subjectMap.get(lesson.subjectId);
      const group = groupMap.get(lesson.studentGroupId);
      return {
        id: String(lesson.id),
        name: subject?.name || `Môn ${lesson.subjectId}`,
        lecturer: teacher?.name || `GV ${lesson.teacherId}`,
        classGroup: group?.name || `Lớp ${lesson.studentGroupId}`,
        students: group?.size ?? 0,
        deliveryMode: lesson.deliveryMode ?? 0,
      };
    });
  };

  const handleLoad = async () => {
    const trimmedId = scenarioId.trim();
    if (!trimmedId) {
      setMessage(t.loadError);
      return;
    }

    setIsLoading(true);
    setMessage("");
    setHasLoaded(false);
    try {
      const result = await getScheduleResult(trimmedId);
      const schedule = result?.schedule || result;
      if (!schedule || !schedule.lessons) {
        throw new Error(t.noData);
      }
      setCourses(mapScheduleToCourses(schedule));
      setHasLoaded(true);
    } catch (err) {
      setMessage(err.message || t.noData);
      setCourses([]);
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="form-card" aria-label="Lecturer grade form">
      <div className="form-row">
        <label htmlFor="student">{t.student}</label>
        <p id="student" className="student-value">
          {user ? `${user.username} - ${user.name}` : t.unknownStudent}
        </p>
      </div>
      <div className="form-row">
        <label htmlFor="academic-year">{t.cohort}</label>
        <select
          id="academic-year"
          value={selectedCohort}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedCohort(value);
            if (!scenarioId) setScenarioId(value);
          }}
        >
          <option value="" >{t.selectCohort}</option>
          {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="scenario-id">{t.scenario}</label>
        <input
          id="scenario-id"
          type="text"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          placeholder="scenario-..."
        />
      </div>

      <div className="grade-actions">
        <button type="button" className="user-btn" onClick={handleLoad} disabled={isLoading}>
          {isLoading ? "..." : t.load}
        </button>
      </div>

      {message && <div className="grade-message">{message}</div>}

      {hasLoaded && !message && courses.length === 0 && (
        <div className="empty-state">{t.noData}</div>
      )}

      {selectedCohort && courses.length > 0 && (
        <div className="schedule-table-wrapper">
          <h3>{t.scheduleList} - {selectedCohort}</h3>
          <table className="demo-table data-table">
            <thead>
              <tr>
                <th>{t.courseCol}</th>
                <th>{t.lecturerCol}</th>
                <th>{t.classCol}</th>
                <th>{t.modeCol}</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>{course.name}</td>
                  <td>{course.lecturer}</td>
                  <td>{course.classGroup}</td>
                  <td>{DeliveryModeLabels[course.deliveryMode] || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
