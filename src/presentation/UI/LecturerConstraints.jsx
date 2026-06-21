/**
 * AvailabilityGrid — Visual grid for lecturers to register availability.
 *
 * Click to cycle:  ⬜ empty → ✅ Rảnh → ⭐ Ưa thích → ⬜ empty
 *
 * Maps directly to backend:
 *   ✅ Rảnh      → AvailableWindow (hard constraint)
 *   ⭐ Ưa thích  → AvailableWindow + LecturerConstraint(isPreferred=true)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMyConstraints,
  registerConstraint,
  deleteConstraint,
  getMyAvailableWindows,
  registerAvailableWindow,
  deleteAvailableWindow,
  getTimeSlots,
} from "../../services/lecturerService";

const DAYS = [
  { idx: 1, label: "Thứ 2", en: "Mon" },
  { idx: 2, label: "Thứ 3", en: "Tue" },
  { idx: 3, label: "Thứ 4", en: "Wed" },
  { idx: 4, label: "Thứ 5", en: "Thu" },
  { idx: 5, label: "Thứ 6", en: "Fri" },
  { idx: 6, label: "Thứ 7", en: "Sat" },
];

const PERIODS = [
  { id: 1,  label: "Tiết 1",  time: "07:00-07:50" },
  { id: 2,  label: "Tiết 2",  time: "07:55-08:45" },
  { id: 3,  label: "Tiết 3",  time: "08:50-09:40" },
  { id: 4,  label: "Tiết 4",  time: "09:50-10:40" },
  { id: 5,  label: "Tiết 5",  time: "10:45-11:35" },
  { id: 6,  label: "Tiết 6",  time: "11:40-12:30" },
  { id: 7,  label: "Tiết 7",  time: "13:00-13:50" },
  { id: 8,  label: "Tiết 8",  time: "13:55-14:45" },
  { id: 9,  label: "Tiết 9",  time: "14:50-15:40" },
  { id: 10, label: "Tiết 10", time: "15:50-16:40" },
  { id: 11, label: "Tiết 11", time: "16:45-17:35" },
  { id: 12, label: "Tiết 12", time: "17:40-18:30" },
];

// States: "empty" → "available" → "preferred" → "empty"
const STATES = ["empty", "available", "preferred"];
const NEXT_STATE = { empty: "available", available: "preferred", preferred: "empty" };

const STATE_DISPLAY = {
  empty:     { icon: "",  bg: "transparent",  border: "#e2e8f0", text: "#94a3b8" },
  available: { icon: "✓", bg: "#DCFCE7",      border: "#22C55E", text: "#166534" },
  preferred: { icon: "★", bg: "#FEF3C7",      border: "#F59E0B", text: "#92400E" },
};

const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export default function AvailabilityGrid({ user, language }) {
  const isVi = language === "Vietnamese";
  const [timeSlots, setTimeSlots] = useState([]);  // from DB
  const [grid, setGrid] = useState({});             // "dayIdx-periodId" → "empty"|"available"|"preferred"
  const [windowMap, setWindowMap] = useState({});    // "dayIdx-periodId" → windowId
  const [constraintMap, setConstraintMap] = useState({}); // "dayIdx-periodId" → constraintId
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const initialGrid = useRef({});

  // ─── Map a TimeSlot to a Period ───
  const findPeriod = useCallback((dayOfWeek, startTime) => {
    const startMins = toMinutes(startTime);
    let best = null, bestDiff = Infinity;
    for (const p of PERIODS) {
      const pStart = toMinutes(p.time.split("-")[0]);
      const diff = Math.abs(pStart - startMins);
      if (diff < bestDiff) { bestDiff = diff; best = p; }
    }
    return best;
  }, []);

  // ─── Build timeSlot lookup: "dayIdx-periodId" → timeSlotId ───
  const slotLookup = {};
  timeSlots.forEach((ts) => {
    const period = findPeriod(ts.dayOfWeek, ts.startTime);
    if (period) {
      slotLookup[`${ts.dayOfWeek}-${period.id}`] = ts.id;
    }
  });

  // ─── Load data ───
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [slots, windows, constraints] = await Promise.all([
        getTimeSlots(),
        getMyAvailableWindows(),
        getMyConstraints(),
      ]);

      setTimeSlots(Array.isArray(slots) ? slots : []);

      const wArr = Array.isArray(windows) ? windows : [];
      const cArr = Array.isArray(constraints) ? constraints : [];

      // Build grid state from existing data
      const newGrid = {};
      const newWindowMap = {};
      const newConstraintMap = {};

      // Mark available windows
      wArr.forEach((w) => {
        // Find which periods this window covers
        const wStartMins = toMinutes(w.startTime.slice(0, 5));
        const wEndMins = toMinutes(w.endTime.slice(0, 5));

        PERIODS.forEach((p) => {
          const pStart = toMinutes(p.time.split("-")[0]);
          const pEnd = toMinutes(p.time.split("-")[1]);
          if (pStart >= wStartMins && pEnd <= wEndMins) {
            const key = `${w.dayOfWeek}-${p.id}`;
            newGrid[key] = "available";
            newWindowMap[key] = w.id;
          }
        });
      });

      // Mark preferred constraints (upgrade available → preferred)
      cArr.forEach((c) => {
        if (!c.isPreferred) return;
        // Find which cell this timeSlotId maps to
        const matchSlot = (Array.isArray(slots) ? slots : []).find(s => s.id === c.timeSlotId);
        if (matchSlot) {
          const period = PERIODS.find(p => {
            const pStart = toMinutes(p.time.split("-")[0]);
            return Math.abs(pStart - toMinutes(matchSlot.startTime)) < 10;
          });
          if (period) {
            const key = `${matchSlot.dayOfWeek}-${period.id}`;
            newGrid[key] = "preferred";
            newConstraintMap[key] = c.id;
          }
        }
      });

      setGrid(newGrid);
      setWindowMap(newWindowMap);
      setConstraintMap(newConstraintMap);
      initialGrid.current = { ...newGrid };
    } catch (err) {
      setMsg({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ─── Toggle cell ───
  const toggleCell = (dayIdx, periodId) => {
    if (saving) return;
    const key = `${dayIdx}-${periodId}`;
    const current = grid[key] || "empty";
    const next = NEXT_STATE[current];
    setGrid((prev) => ({ ...prev, [key]: next }));
    setMsg({ text: "", type: "" });
  };

  // ─── Count stats ───
  const availCount = Object.values(grid).filter(v => v === "available").length;
  const prefCount = Object.values(grid).filter(v => v === "preferred").length;
  const hasChanges = JSON.stringify(grid) !== JSON.stringify(initialGrid.current);

  // ─── Save all changes ───
  const handleSave = async () => {
    setSaving(true);
    setMsg({ text: "", type: "" });

    try {
      // 1. Delete ALL existing windows and constraints
      const existingWindows = await getMyAvailableWindows();
      const existingConstraints = await getMyConstraints();

      for (const w of (Array.isArray(existingWindows) ? existingWindows : [])) {
        if (!w.isLocked) await deleteAvailableWindow(w.id);
      }
      for (const c of (Array.isArray(existingConstraints) ? existingConstraints : [])) {
        await deleteConstraint(c.id);
      }

      // 2. Group consecutive periods per day into windows
      for (const day of DAYS) {
        const dayPeriods = PERIODS
          .filter(p => {
            const key = `${day.idx}-${p.id}`;
            return grid[key] === "available" || grid[key] === "preferred";
          })
          .sort((a, b) => a.id - b.id);

        if (dayPeriods.length === 0) continue;

        // Group consecutive periods into blocks
        let blockStart = dayPeriods[0];
        let blockEnd = dayPeriods[0];

        for (let i = 1; i <= dayPeriods.length; i++) {
          const current = dayPeriods[i];
          const isConsecutive = current && (
            current.id === blockEnd.id + 1 ||
            (blockEnd.id === 6 && current.id === 7) // across lunch break
          );

          if (isConsecutive) {
            blockEnd = current;
          } else {
            // Save this block as a window
            const startTime = blockStart.time.split("-")[0] + ":00";
            const endTime = blockEnd.time.split("-")[1] + ":00";
            await registerAvailableWindow({
              dayOfWeek: day.idx,
              startTime,
              endTime,
            });
            if (current) {
              blockStart = current;
              blockEnd = current;
            }
          }
        }
      }

      // 3. Create constraints for preferred slots
      for (const day of DAYS) {
        for (const period of PERIODS) {
          const key = `${day.idx}-${period.id}`;
          if (grid[key] !== "preferred") continue;

          // Find timeSlotId for this cell
          const matchSlot = timeSlots.find(ts => {
            if (ts.dayOfWeek !== day.idx) return false;
            const pStart = toMinutes(period.time.split("-")[0]);
            return Math.abs(toMinutes(ts.startTime) - pStart) < 10;
          });

          if (matchSlot) {
            await registerConstraint({
              timeSlotId: matchSlot.id,
              isPreferred: true,
              weight: 10,
            });
          }
        }
      }

      setMsg({ text: isVi ? "✅ Đã lưu lịch rảnh thành công!" : "✅ Availability saved!", type: "success" });
      await loadAll(); // Reload to sync
    } catch (err) {
      setMsg({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Reset ───
  const handleReset = () => {
    setGrid({ ...initialGrid.current });
    setMsg({ text: "", type: "" });
  };

  if (loading) {
    return (
      <div className="ag-loading">
        <div className="ag-spinner" />
        <p>{isVi ? "Đang tải dữ liệu..." : "Loading data..."}</p>
      </div>
    );
  }

  return (
    <div className="availability-grid-page">
      {/* ─── Header ─── */}
      <div className="ag-header">
        <div className="ag-header-left">
          <h3 className="ag-title">
            📅 {isVi ? "Đăng ký lịch rảnh" : "Register Availability"}
          </h3>
          <p className="ag-subtitle">
            {isVi
              ? "Click vào ô để đánh dấu thời gian rảnh hoặc ưa thích"
              : "Click cells to mark available or preferred times"}
          </p>
        </div>
        <div className="ag-header-right">
          <button
            className="ag-btn ag-btn-reset"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            ↺ {isVi ? "Hoàn tác" : "Reset"}
          </button>
          <button
            className="ag-btn ag-btn-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "⏳" : "💾"} {saving ? (isVi ? "Đang lưu..." : "Saving...") : (isVi ? "Lưu thay đổi" : "Save")}
          </button>
        </div>
      </div>

      {/* ─── Legend ─── */}
      <div className="ag-legend">
        <div className="ag-legend-item">
          <div className="ag-legend-swatch ag-swatch-empty" />
          <span>{isVi ? "Bận / Chưa đăng ký" : "Busy / Not set"}</span>
        </div>
        <div className="ag-legend-item">
          <div className="ag-legend-swatch ag-swatch-available" />
          <span>✓ {isVi ? "Rảnh (có thể xếp lịch)" : "Available"}</span>
        </div>
        <div className="ag-legend-item">
          <div className="ag-legend-swatch ag-swatch-preferred" />
          <span>★ {isVi ? "Ưa thích (ưu tiên xếp)" : "Preferred"}</span>
        </div>
        <div className="ag-legend-stats">
          <span className="ag-stat available">✓ {availCount}</span>
          <span className="ag-stat preferred">★ {prefCount}</span>
        </div>
      </div>

      {/* ─── Message ─── */}
      {msg.text && <div className={`ag-msg ${msg.type}`}>{msg.text}</div>}

      {/* ─── Grid ─── */}
      <div className="ag-grid-wrapper">
        <div className="ag-grid">
          {/* Header */}
          <div className="ag-corner">{isVi ? "Tiết" : "Period"}</div>
          {DAYS.map((d) => (
            <div key={d.idx} className="ag-day-header">
              {isVi ? d.label : d.en}
            </div>
          ))}

          {/* Morning periods */}
          {PERIODS.slice(0, 6).map((p) => (
            <GridRow
              key={p.id}
              period={p}
              days={DAYS}
              grid={grid}
              onToggle={toggleCell}
              saving={saving}
            />
          ))}

          {/* Lunch break */}
          <div className="ag-break">
            12:30 - 13:00 — {isVi ? "NGHỈ TRƯA" : "LUNCH BREAK"}
          </div>

          {/* Afternoon periods */}
          {PERIODS.slice(6).map((p) => (
            <GridRow
              key={p.id}
              period={p}
              days={DAYS}
              grid={grid}
              onToggle={toggleCell}
              saving={saving}
            />
          ))}
        </div>
      </div>

      {/* ─── Quick actions ─── */}
      <div className="ag-quick-actions">
        <button className="ag-quick-btn" onClick={() => {
          const newGrid = {};
          DAYS.forEach(d => PERIODS.forEach(p => { newGrid[`${d.idx}-${p.id}`] = "available"; }));
          setGrid(newGrid);
        }}>
          ✓ {isVi ? "Đánh dấu tất cả rảnh" : "Mark all available"}
        </button>
        <button className="ag-quick-btn" onClick={() => setGrid({})}>
          ✕ {isVi ? "Xóa tất cả" : "Clear all"}
        </button>
        <button className="ag-quick-btn" onClick={() => {
          const newGrid = { ...grid };
          DAYS.forEach(d => {
            [1,2,3,4,5,6].forEach(p => { newGrid[`${d.idx}-${p}`] = "available"; });
          });
          setGrid(newGrid);
        }}>
          🌅 {isVi ? "Rảnh buổi sáng" : "Morning available"}
        </button>
        <button className="ag-quick-btn" onClick={() => {
          const newGrid = { ...grid };
          DAYS.forEach(d => {
            [7,8,9,10,11,12].forEach(p => { newGrid[`${d.idx}-${p}`] = "available"; });
          });
          setGrid(newGrid);
        }}>
          🌆 {isVi ? "Rảnh buổi chiều" : "Afternoon available"}
        </button>
      </div>
    </div>
  );
}

// ─── Grid Row Component ──────────────────────────────────────────────────
function GridRow({ period, days, grid, onToggle, saving }) {
  return (
    <>
      <div className="ag-period-label">
        <span className="ag-period-name">{period.label}</span>
        <span className="ag-period-time">{period.time}</span>
      </div>
      {days.map((d) => {
        const key = `${d.idx}-${period.id}`;
        const state = grid[key] || "empty";
        const display = STATE_DISPLAY[state];
        return (
          <div
            key={key}
            className={`ag-cell ag-cell-${state}`}
            onClick={() => onToggle(d.idx, period.id)}
            style={{
              "--cell-bg": display.bg,
              "--cell-border": display.border,
              "--cell-text": display.text,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {display.icon && <span className="ag-cell-icon">{display.icon}</span>}
          </div>
        );
      })}
    </>
  );
}
