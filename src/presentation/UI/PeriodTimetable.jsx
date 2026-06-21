/**
 * PeriodTimetable — Shared read-only timetable grid for Lecturer & Student dashboards.
 * Uses CSS Grid with row spanning for multi-period lessons.
 */
import { useMemo } from "react";

const DAYS = [
  { idx: 1, label: "Thứ 2" },
  { idx: 2, label: "Thứ 3" },
  { idx: 3, label: "Thứ 4" },
  { idx: 4, label: "Thứ 5" },
  { idx: 5, label: "Thứ 6" },
  { idx: 6, label: "Thứ 7" },
];

const PERIODS = [
  { id: 1,  label: "Tiết 1",  time: "07:00 - 07:50", start: "07:00", row: 2 },
  { id: 2,  label: "Tiết 2",  time: "07:55 - 08:45", start: "07:55", row: 3 },
  { id: 3,  label: "Tiết 3",  time: "08:50 - 09:40", start: "08:50", row: 4 },
  { id: 4,  label: "Tiết 4",  time: "09:50 - 10:40", start: "09:50", row: 5 },
  { id: 5,  label: "Tiết 5",  time: "10:45 - 11:35", start: "10:45", row: 6 },
  { id: 6,  label: "Tiết 6",  time: "11:40 - 12:30", start: "11:40", row: 7 },
  // break row = 8
  { id: 7,  label: "Tiết 7",  time: "13:00 - 13:50", start: "13:00", row: 9 },
  { id: 8,  label: "Tiết 8",  time: "13:55 - 14:45", start: "13:55", row: 10 },
  { id: 9,  label: "Tiết 9",  time: "14:50 - 15:40", start: "14:50", row: 11 },
  { id: 10, label: "Tiết 10", time: "15:50 - 16:40", start: "15:50", row: 12 },
  { id: 11, label: "Tiết 11", time: "16:45 - 17:35", start: "16:45", row: 13 },
  { id: 12, label: "Tiết 12", time: "17:40 - 18:30", start: "17:40", row: 14 },
];

const PERIOD_ROW_MAP = {};
PERIODS.forEach(p => { PERIOD_ROW_MAP[p.id] = p.row; });

const BREAK_ROW = 8;
const TOTAL_ROWS = 15; // 1 header + 6 morning + 1 break + 6 afternoon + 1 buffer

const toMinutes = (t) => {
  if (!t) return 0;
  const s = String(t);
  const clean = s.includes("T") ? s.split("T")[1] : s;
  const [h, m] = clean.split(":");
  return Number(h) * 60 + Number(m);
};

const getPeriodId = (startTime) => {
  const mins = toMinutes(startTime);
  let closest = 1, minDiff = Infinity;
  PERIODS.forEach((p) => {
    const diff = Math.abs(toMinutes(p.start) - mins);
    if (diff < minDiff) { minDiff = diff; closest = p.id; }
  });
  return closest;
};

// Curated color palette
const PALETTE = [
  { bg: "#EFF6FF", border: "#3B82F6", text: "#1E40AF", accent: "#DBEAFE" },
  { bg: "#FFF7ED", border: "#F97316", text: "#9A3412", accent: "#FFEDD5" },
  { bg: "#F0FDF4", border: "#22C55E", text: "#166534", accent: "#DCFCE7" },
  { bg: "#FDF2F8", border: "#EC4899", text: "#9D174D", accent: "#FCE7F3" },
  { bg: "#F5F3FF", border: "#8B5CF6", text: "#5B21B6", accent: "#EDE9FE" },
  { bg: "#FFFBEB", border: "#EAB308", text: "#854D0E", accent: "#FEF3C7" },
  { bg: "#ECFDF5", border: "#10B981", text: "#065F46", accent: "#D1FAE5" },
  { bg: "#FFF1F2", border: "#F43F5E", text: "#9F1239", accent: "#FFE4E6" },
  { bg: "#F0F9FF", border: "#0EA5E9", text: "#0C4A6E", accent: "#E0F2FE" },
  { bg: "#FAF5FF", border: "#A855F7", text: "#6B21A8", accent: "#F3E8FF" },
];

const getColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

export default function PeriodTimetable({ lessons = [], role = "lecturer", language = "Vietnamese" }) {
  const isVi = language === "Vietnamese";

  // Build positioned lessons: { lesson, col, rowStart, rowSpan }
  const positioned = useMemo(() => {
    return lessons
      .filter(l => l.dayOfWeek != null && l.startTime)
      .map((l) => {
        const dayIdx = Number(l.dayOfWeek);
        if (dayIdx < 1 || dayIdx > 6) return null;
        const periodId = getPeriodId(l.startTime);
        const row = PERIOD_ROW_MAP[periodId];
        if (!row) return null;
        const duration = l.sessionDuration || 1;
        // col: day 1→2, day 2→3, etc. (col 1 = period labels)
        const col = dayIdx + 1;
        // Handle break row: if span crosses row 8, add 1
        let rowSpan = duration;
        if (row <= 7 && row + duration - 1 >= BREAK_ROW) rowSpan += 1;
        return { lesson: l, col, row, rowSpan };
      })
      .filter(Boolean);
  }, [lessons]);

  return (
    <div className="pt-wrapper">
      <div className="pt-container">
        {/* ─── Header Row ─── */}
        <div className="pt-header-cell pt-corner-cell">
          <span>{isVi ? "Tiết" : "Period"}</span>
        </div>
        {DAYS.map((d) => (
          <div key={d.idx} className="pt-header-cell" style={{ gridColumn: d.idx + 1 }}>
            {d.label}
          </div>
        ))}

        {/* ─── Period Labels ─── */}
        {PERIODS.map((p) => (
          <div key={p.id} className="pt-label" style={{ gridRow: p.row, gridColumn: 1 }}>
            <span className="pt-label-name">{p.label}</span>
            <span className="pt-label-time">{p.time}</span>
          </div>
        ))}

        {/* ─── Break Row ─── */}
        <div className="pt-break-row" style={{ gridRow: BREAK_ROW, gridColumn: "1 / -1" }}>
          12:30 - 13:00 — {isVi ? "NGHỈ TRƯA" : "LUNCH BREAK"}
        </div>

        {/* ─── Empty cells (background grid) ─── */}
        {PERIODS.map((p) =>
          DAYS.map((d) => (
            <div
              key={`bg-${p.id}-${d.idx}`}
              className="pt-bg-cell"
              style={{ gridRow: p.row, gridColumn: d.idx + 1 }}
            />
          ))
        )}

        {/* ─── Lesson Cards ─── */}
        {positioned.map((item, i) => {
          const { lesson: l, col, row, rowSpan } = item;
          const color = getColor(l.courseName);
          return (
            <div
              key={i}
              className="pt-card"
              style={{
                gridColumn: col,
                gridRow: `${row} / span ${rowSpan}`,
                "--card-bg": color.bg,
                "--card-border": color.border,
                "--card-text": color.text,
                "--card-accent": color.accent,
              }}
            >
              <div className="pt-card-stripe" />
              <div className="pt-card-content">
                <div className="pt-card-title">{l.courseName}</div>
                <div className="pt-card-code">{l.sectionCode}</div>
                {role === "lecturer" && l.studentGroupNames?.length > 0 && (
                  <div className="pt-card-meta">
                    <span className="pt-meta-icon">👥</span> {l.studentGroupNames.join(", ")}
                  </div>
                )}
                {role === "student" && l.teacherNames?.length > 0 && (
                  <div className="pt-card-meta">
                    <span className="pt-meta-icon">👨‍🏫</span> {l.teacherNames.join(", ")}
                  </div>
                )}
                {l.roomName && (
                  <div className="pt-card-meta">
                    <span className="pt-meta-icon">🏫</span> {l.roomName}
                  </div>
                )}
                {rowSpan > 1 && (
                  <div className="pt-card-duration">
                    {l.sessionDuration} {isVi ? "tiết" : "periods"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
