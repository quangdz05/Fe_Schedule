import { useEffect, useState, useCallback } from "react";
import { getPendingSections } from "../../services/scheduleService";
import { DeliveryModeLabels, RoomTypeLabels, CourseTypeLabels } from "../../constants/enums";

/**
 * SectionPicker — bảng chọn course sections chờ xếp lịch.
 * Props:
 *   onSectionsSelected(ids[])  — gọi khi selection thay đổi
 *   disabled                   — tắt tương tác khi đang solve
 */
export default function SectionPicker({ onSectionsSelected, disabled }) {
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPendingSections();
        if (!cancelled) setSections(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const ids = filteredSections.map((s) => s.id);
    setSelected(new Set(ids));
  }, [sections, filterText]);

  const clearAll = useCallback(() => setSelected(new Set()), []);

  useEffect(() => {
    if (typeof onSectionsSelected === "function") {
      onSectionsSelected(Array.from(selected));
    }
  }, [selected]);

  const filteredSections = sections.filter((s) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    const teachers = (s.teacherNames ?? []).join(" ");
    const groups   = (s.studentGroupNames ?? []).join(" ");
    return (
      s.courseName?.toLowerCase().includes(q) ||
      s.sectionCode?.toLowerCase().includes(q) ||
      teachers.toLowerCase().includes(q) ||
      groups.toLowerCase().includes(q) ||
      String(s.id).includes(q)
    );
  });

  const applyManual = () => {
    const ids = manualInput
      .split(/[\s,;]+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
    setSelected(new Set(ids));
  };

  return (
    <div className="section-picker">
      <div className="sp-header">
        <span className="sp-title">Chon Sections can xep lich</span>
        <button
          type="button"
          className={`sp-toggle-manual ${manualMode ? "active" : ""}`}
          onClick={() => setManualMode((m) => !m)}
          disabled={disabled}
        >
          {manualMode ? "Quay lai danh sach" : "Nhap ID thu cong"}
        </button>
      </div>

      {manualMode ? (
        <div className="sp-manual">
          <p className="sp-manual-hint">Nhap cac Section ID (1-52), cach nhau bang dau phay hoac khoang trang:</p>
          <div className="sp-manual-row">
            <input
              type="text"
              className="sp-manual-input"
              placeholder="VD: 1, 2, 5, 10, 23"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              disabled={disabled}
            />
            <button type="button" className="sp-btn apply" onClick={applyManual} disabled={disabled}>
              Áp dụng
            </button>
          </div>
          {selected.size > 0 && (
            <div className="sp-manual-tags">
              {Array.from(selected).map((id) => (
                <span key={id} className="sp-tag">
                  ID {id}
                  <button onClick={() => toggle(id)} disabled={disabled}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {loading && <div className="sp-loading"><span className="sp-spinner" />Dang tai danh sach sections...</div>}
          {error && <div className="sp-error">Lỗi: {error}</div>}

          {!loading && !error && sections.length === 0 && (
            <div className="sp-empty-state">
              <span className="sp-empty-icon"></span>
              <strong>Tat ca da duoc xep lich!</strong>
              <p>Khong con section nao cho xep. Dung che do nhap thu cong de re-solve.</p>
              <button type="button" className="sp-btn" onClick={() => setManualMode(true)}>
                Nhap ID thu cong
              </button>
            </div>
          )}

          {!loading && !error && sections.length > 0 && (
            <>
              <div className="sp-toolbar">
                <input
                  type="search"
                  className="sp-search"
                  placeholder="Loc theo ten mon, GV, nhom..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  disabled={disabled}
                />
                <div className="sp-bulk-btns">
                  <button type="button" className="sp-btn" onClick={selectAll} disabled={disabled}>Chon tat ca ({filteredSections.length})</button>
                  <button type="button" className="sp-btn ghost" onClick={clearAll} disabled={disabled}>Bo chon</button>
                </div>
              </div>

              <div className="sp-count-bar">
                <span className="sp-selected-count">Da chon <strong>{selected.size}</strong> / {sections.length} sections</span>
              </div>

              <div className="sp-table-wrap">
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>ID</th>
                      <th>Tên Môn</th>
                      <th>Giảng viên</th>
                      <th>Nhóm SV</th>
                      <th>Loại môn</th>
                      <th>Phòng</th>
                      <th>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSections.map((s) => {
                      const isSelected = selected.has(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={`sp-row ${isSelected ? "selected" : ""}`}
                          onClick={() => !disabled && toggle(s.id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggle(s.id)}
                              disabled={disabled}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="sp-id">{s.id}</td>
                          <td className="sp-course">{s.courseName ?? `Course ${s.courseId}`}</td>
                          <td className="sp-teacher">{(s.teacherNames ?? []).join(", ") || "—"}</td>
                          <td className="sp-group">{(s.studentGroupNames ?? []).join(", ") || "—"}</td>
                          <td>
                            <span className={`sp-badge course-type-${s.courseType ?? 0}`}>
                              {CourseTypeLabels[s.courseType ?? 0] ?? "—"}
                            </span>
                          </td>
                          <td>{RoomTypeLabels[s.requiredRoomType ?? 0] ?? "—"}</td>
                          <td>{DeliveryModeLabels[s.deliveryMode ?? 0] ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
