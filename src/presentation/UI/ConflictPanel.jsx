/**
 * ConflictPanel.jsx — Phase 3.3
 * Hiển thị conflicts từ schedule.conflicts[], nhóm theo level, click highlight lessons.
 */
import { useMemo, useState } from "react";
import { ConflictLevel, ConflictLevelLabels, ConflictLevelKeys } from "../../constants/enums";

const LEVEL_ORDER = [ConflictLevel.Hard, ConflictLevel.Warning, ConflictLevel.Soft];

export default function ConflictPanel({ conflicts = [], onHighlightLessons }) {
  const [expanded, setExpanded] = useState(new Set([ConflictLevel.Hard]));

  const grouped = useMemo(() => {
    const g = { [ConflictLevel.Hard]: [], [ConflictLevel.Warning]: [], [ConflictLevel.Soft]: [] };
    for (const c of conflicts) {
      const lvl = c.level ?? c.Level ?? ConflictLevel.Soft;
      if (g[lvl]) g[lvl].push(c);
    }
    return g;
  }, [conflicts]);

  const totalHard    = grouped[ConflictLevel.Hard].length;
  const totalWarning = grouped[ConflictLevel.Warning].length;
  const totalSoft    = grouped[ConflictLevel.Soft].length;

  const toggleSection = (level) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  };

  const handleConflictClick = (conflict) => {
    const ids = conflict.affectedEntityIds ?? conflict.AffectedEntityIds ?? [];
    onHighlightLessons?.(ids.map(String));
  };

  if (conflicts.length === 0) {
    return (
      <div className="conflict-panel">
        <div className="conflict-panel-header">
          <span>🚦 Xung đột lịch</span>
        </div>
        <div className="conflict-empty">✅ Không có xung đột nào!</div>
      </div>
    );
  }

  return (
    <div className="conflict-panel">
      {/* Header with badge counts */}
      <div className="conflict-panel-header">
        <span>🚦 Xung đột lịch</span>
        <div className="conflict-badges">
          {totalHard > 0 && <span className="conflict-badge hard">⛔ {totalHard}</span>}
          {totalWarning > 0 && <span className="conflict-badge warning">⚠️ {totalWarning}</span>}
          {totalSoft > 0 && <span className="conflict-badge soft">ℹ️ {totalSoft}</span>}
        </div>
      </div>

      {/* Grouped sections */}
      {LEVEL_ORDER.map((level) => {
        const items = grouped[level];
        if (items.length === 0) return null;
        const key = ConflictLevelKeys[level];
        const label = ConflictLevelLabels[level];
        const isOpen = expanded.has(level);

        return (
          <div key={level} className={`conflict-group ${key}`}>
            <button
              type="button"
              className="conflict-group-toggle"
              onClick={() => toggleSection(level)}
            >
              <span>{label}</span>
              <span className="conflict-group-count">{items.length}</span>
              <span className="conflict-group-chevron">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
              <ul className="conflict-list">
                {items.map((c) => {
                  const affectedIds = c.affectedEntityIds ?? c.AffectedEntityIds ?? [];
                  const desc = c.description ?? c.Description ?? `Xung đột #${c.id}`;
                  return (
                    <li
                      key={c.id ?? Math.random()}
                      className={`conflict-item ${key}`}
                      title={affectedIds.length > 0 ? "Click để highlight lesson liên quan" : undefined}
                      onClick={() => handleConflictClick(c)}
                      style={{ cursor: affectedIds.length > 0 ? "pointer" : "default" }}
                    >
                      <span className="conflict-desc">{desc}</span>
                      {affectedIds.length > 0 && (
                        <span className="conflict-affected">
                          🔍 {affectedIds.length} tiết liên quan
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
