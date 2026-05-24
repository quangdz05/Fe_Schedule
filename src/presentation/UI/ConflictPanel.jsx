import { useMemo, useState } from "react";
import { ConflictTypeLabelMap } from "../../constants/enums";

/**
 * ConflictPanel — hiển thị danh sách conflicts từ kết quả solve.
 * Props:
 *   conflicts[]                — mảng ScheduleConflictDto
 *   onHighlightLessons(ids[])  — callback khi click conflict item
 */
export default function ConflictPanel({ conflicts = [], onHighlightLessons }) {
  const [expanded, setExpanded] = useState({ 0: true, 1: false, 2: false });

  const grouped = useMemo(() => {
    const groups = { 0: [], 1: [], 2: [] };
    conflicts.forEach((c) => {
      const lvl = c.level ?? 0;
      if (groups[lvl]) groups[lvl].push(c);
    });
    return groups;
  }, [conflicts]);

  const total = conflicts.length;

  const levelMeta = {
    0: { cls: "hard", icon: "!", label: "Lỗi nặng" },
    1: { cls: "soft", icon: "i", label: "Gợi ý" },
    2: { cls: "warning", icon: "!", label: "Cảnh báo" },
  };

  const handleItemClick = (conflict) => {
    if (typeof onHighlightLessons === "function") {
      onHighlightLessons(conflict.affectedEntityIds ?? []);
    }
  };

  const toggleGroup = (lvl) =>
    setExpanded((prev) => ({ ...prev, [lvl]: !prev[lvl] }));

  if (total === 0) {
    return (
      <div className="conflict-panel empty">
        <div className="cp-header">Conflicts</div>
        <div className="cp-no-conflict">
          <strong>Không có xung đột</strong>
          <p>Lịch hiện tại hợp lệ.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conflict-panel">
      <div className="cp-header">
        <span>Conflicts</span>
      </div>

      {[0, 2, 1].map((lvl) => {
        if (grouped[lvl].length === 0) return null;
        const meta = levelMeta[lvl];
        const isOpen = expanded[lvl];
        return (
          <div key={lvl} className={`cp-group ${meta.cls}`}>
            <button
              type="button"
              className="cp-group-header"
              onClick={() => toggleGroup(lvl)}
            >
              <span>{meta.icon} {meta.label}</span>
              <span className="cp-group-count">{grouped[lvl].length}</span>
              <span className="cp-chevron">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div className="cp-group-items">
                {grouped[lvl].map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`conflict-item ${meta.cls}`}
                    title="Click để highlight các lesson liên quan"
                    onClick={() => handleItemClick(c)}
                  >
                    <div className="ci-main">
                      <div className="ci-desc">
                        {c.description || ConflictTypeLabelMap[c.conflictType] || "Conflict không xác định"}
                      </div>
                      <span className="ci-action">Xem</span>
                    </div>
                    {c.affectedEntityIds?.length > 0 && (
                      <div className="ci-entities">
                        {c.affectedEntityIds.map((id) => (
                          <span key={id} className="ci-entity-id">#{id}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
