import { useState } from "react";
import { courses } from "../../data";

export default function GradeForm({ user, language = "English" }) {
  const [selectedCohort, setSelectedCohort] = useState("");

  const isVi = language === "Vietnamese";

  const t = {
    student: isVi ? "Giảng Viên *" : "Lecturer *",
    cohort: isVi ? "Khóa *" : "Cohort *",
    selectCohort: isVi ? "Chọn khóa..." : "Select cohort...",
    unknownStudent: isVi ? "Không rõ giảng viên" : "Unknown Lecturer",
    scheduleList: isVi ? "Danh sách giảng dạy" : "Teaching Schedule",
    courseCol: isVi ? "Môn học" : "Course",
    lecturerCol: isVi ? "Giảng viên" : "Lecturer",
    modeCol: isVi ? "Hình thức" : "Mode",
    classCol: isVi ? "Lớp" : "Class"
  };

  const cohorts = ["VJU2022", "VJU2023", "VJU2024", "VJU2025"];

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
        <select id="academic-year" value={selectedCohort} onChange={(e) => setSelectedCohort(e.target.value)}>
          <option value="" >{t.selectCohort}</option>
          {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {selectedCohort && (
        <div className="schedule-table-wrapper">
          <h3 style={{ marginBottom: '10px', fontSize: '1.1rem', color: '#333' }}>{t.scheduleList} - {selectedCohort}</h3>
          <table className="demo-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>{t.courseCol}</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>{t.lecturerCol}</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>{t.classCol}</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>{t.modeCol}</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{course.name}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{course.lecturerIcon} {course.lecturer}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{course.classGroup}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{course.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
