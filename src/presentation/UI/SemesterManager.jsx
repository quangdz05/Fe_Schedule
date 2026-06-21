import { useState, useEffect } from "react";
import { getAllSemesters, createSemester, updateSemester } from "../../services/semesterService";

export default function SemesterManager({ user, language }) {
  const isVi = language === "Vietnamese";
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    academicYear: "",
    startDate: "",
    endDate: "",
    isActive: false,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAllSemesters();
      setSemesters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", academicYear: "", startDate: "", endDate: "", isActive: false });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      academicYear: s.academicYear,
      startDate: s.startDate,
      endDate: s.endDate,
      isActive: s.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await updateSemester(editingId, form);
      } else {
        await createSemester(form);
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="semester-page">
      <div className="semester-header">
        <div className="dashboard-title">
          <span className="dashboard-icon">🗓️</span>
          <div>
            <h3>{isVi ? "Quản lý học kỳ" : "Semester Management"}</h3>
            <p className="dashboard-subtitle">
              {isVi ? "Tạo và quản lý các học kỳ" : "Create and manage semesters"}
            </p>
          </div>
        </div>
        <button className="cf-submit" onClick={openCreate}>
          ➕ {isVi ? "Tạo học kỳ" : "New Semester"}
        </button>
      </div>

      {error && <div className="dashboard-msg error">{error}</div>}
      {loading && <div className="dashboard-msg">{isVi ? "Đang tải..." : "Loading..."}</div>}

      {!loading && (
        <div className="semester-table-wrap">
          <table className="semester-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{isVi ? "Tên" : "Name"}</th>
                <th>{isVi ? "Năm học" : "Academic Year"}</th>
                <th>{isVi ? "Bắt đầu" : "Start"}</th>
                <th>{isVi ? "Kết thúc" : "End"}</th>
                <th>{isVi ? "Trạng thái" : "Status"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {semesters.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                    {isVi ? "Chưa có học kỳ nào." : "No semesters found."}
                  </td>
                </tr>
              ) : (
                semesters.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.academicYear}</td>
                    <td>{s.startDate}</td>
                    <td>{s.endDate}</td>
                    <td>
                      {s.isActive ? (
                        <span className="semester-badge active">✅ Active</span>
                      ) : (
                        <span className="semester-badge inactive">Inactive</span>
                      )}
                    </td>
                    <td>
                      <button className="ci-edit-btn" onClick={() => openEdit(s)}>
                        ✏️ {isVi ? "Sửa" : "Edit"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Modal ═══ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? (isVi ? "Sửa học kỳ" : "Edit Semester") : (isVi ? "Tạo học kỳ mới" : "New Semester")}</h3>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="mf-row">
                <label>{isVi ? "Tên" : "Name"}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Học kỳ 1"
                />
              </div>
              <div className="mf-row">
                <label>{isVi ? "Năm học" : "Academic Year"}</label>
                <input
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                  required
                  placeholder="e.g. 2026-2027"
                />
              </div>
              <div className="mf-row">
                <label>{isVi ? "Ngày bắt đầu" : "Start Date"}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="mf-row">
                <label>{isVi ? "Ngày kết thúc" : "End Date"}</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </div>
              <div className="mf-row checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  {isVi ? " Active (đang hoạt động)" : " Active"}
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>
                  {isVi ? "Hủy" : "Cancel"}
                </button>
                <button type="submit" className="cf-submit">
                  {editingId ? (isVi ? "Cập nhật" : "Update") : (isVi ? "Tạo" : "Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
