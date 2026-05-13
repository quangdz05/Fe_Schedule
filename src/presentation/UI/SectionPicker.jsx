/**
 * SectionPicker.jsx — Phase 3.1
 * Thay thế ô input "Scenario ID" bằng bảng chọn pending sections từ API.
 */
import { useEffect, useState } from "react";
import { getPendingSections } from "../../services/scheduleService";
import { CourseTypeLabels, DeliveryModeLabels, RoomTypeLabels } from "../../constants/enums";

export default function SectionPicker({ onSectionsSelected, disabled }) {
  const [sections, setSections]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [selected, setSelected]         = useState(new Set());
  const [manualMode, setManualMode]     = useState(false);
  const [manualInput, setManualInput]   = useState("");
  const [allEmpty, setAllEmpty]         = useState(false);

  // Fetch pending sections on mount
  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPendingSections();
        // res lúc này là phần 'data' trong JSON response: { scheduleId, totalPending, items: [...] }
        const items = Array.isArray(res) ? res : (res?.items ?? []);
        setSections(items);
        setAllEmpty(items.length === 0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, []);

  const toggleAll = () => {
    if (selected.size === sections.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sections.map((s) => s.id)));
    }
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (manualMode) {
      const ids = manualInput
        .split(/[\s,;]+/)
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0);
      onSectionsSelected(ids);
    } else {
      onSectionsSelected([...selected]);
    }
  };

  const canConfirm = manualMode
    ? manualInput.trim().length > 0
    : selected.size > 0;

  return (
    <div className="section-picker">
      {/* Header row */}
      <div className="section-picker-header">
        <span className="section-picker-title">
          📚 Chọn học phần cần xếp lịch
          {!loading && !allEmpty && sections.length > 0 && (
            <span className="section-picker-count">{sections.length} học phần đang chờ</span>
          )}
        </span>
        <button
          type="button"
          className="sp-toggle-manual"
          onClick={() => setManualMode((v) => !v)}
        >
          {manualMode ? "◀ Chọn từ danh sách" : "✏️ Nhập thủ công"}
        </button>
      </div>

      {/* Manual input mode */}
      {manualMode && (
        <div className="sp-manual-wrap">
          <input
            className="sp-manual-input"
            type="text"
            placeholder="Nhập IDs (vd: 1, 5, 12-20)"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            disabled={disabled}
          />
          <span className="sp-manual-hint">Nhập ID cách nhau bởi dấu phẩy hoặc khoảng trắng</span>
        </div>
      )}

      {/* Table mode */}
      {!manualMode && (
        <>
          {loading && (
            <div className="sp-loading">
              <span className="sp-spinner" />
              Đang tải danh sách học phần...
            </div>
          )}
          {error && (
            <div className="sp-error">⚠️ {error}</div>
          )}
          {allEmpty && !loading && !error && (
            <div className="sp-all-placed">✅ Tất cả học phần đã được xếp lịch!</div>
          )}
          {sections.length > 0 && !loading && (
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selected.size === sections.length && sections.length > 0}
                        onChange={toggleAll}
                        disabled={disabled}
                        title="Chọn/bỏ tất cả"
                      />
                    </th>
                    <th>Tên Môn</th>
                    <th>Giảng viên</th>
                    <th>Nhóm SV</th>
                    <th>Phòng</th>
                    <th>Mode</th>
                    <th>Loại</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s) => {
                    // API v2 trả về teacherNames (array string) và studentGroupNames (array string)
                    const teacherNames = Array.isArray(s.teacherNames) 
                      ? s.teacherNames.join(", ") 
                      : (s.sectionTeachers ?? []).map(st => st.teacherName ?? `GV ${st.teacherId}`).join(", ");
                    
                    const groupNames = Array.isArray(s.studentGroupNames)
                      ? s.studentGroupNames.join(", ")
                      : (s.studentGroupIds ?? []).join(", ");

                    const roomLabel = RoomTypeLabels[s.requiredRoomType] ?? "—";
                    const modeLabel = DeliveryModeLabels[s.deliveryMode] ?? "—";
                    const typeLabel = CourseTypeLabels[s.courseType] ?? "—";
                    return (
                      <tr
                        key={s.id}
                        className={`section-picker-row ${selected.has(s.id) ? "selected" : ""}`}
                        onClick={() => !disabled && toggleRow(s.id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => toggleRow(s.id)}
                            disabled={disabled}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="sp-td-name">{s.courseName ?? s.name ?? `Môn ${s.courseId}`}</td>
                        <td className="sp-td-teacher">{teacherNames || "—"}</td>
                        <td className="sp-td-group">{groupNames || "—"}</td>
                        <td><span className={`sp-badge room-${s.requiredRoomType}`}>{roomLabel}</span></td>
                        <td><span className={`sp-badge mode-${s.deliveryMode}`}>{modeLabel}</span></td>
                        <td><span className={`sp-badge type-${s.courseType}`}>{typeLabel}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Action row */}
      <div className="sp-actions">
        {!manualMode && sections.length > 0 && (
          <span className="sp-selected-count">
            Đã chọn: <strong>{selected.size}</strong> / {sections.length}
          </span>
        )}
        <button
          type="button"
          className="schedv2-btn primary sp-confirm-btn"
          disabled={disabled || !canConfirm}
          onClick={handleConfirm}
        >
          ⚡ Xếp lịch tự động
        </button>
      </div>
    </div>
  );
}
