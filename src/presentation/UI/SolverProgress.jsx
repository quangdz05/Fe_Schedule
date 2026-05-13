/**
 * SolverProgress.jsx — Phase 3.2
 * Overlay hiển thị khi solver đang chạy: progress bar + phase label + spinner.
 * Nội bộ poll pollSolveStatus mỗi 3s.
 */
import { useEffect, useRef, useState } from "react";
import { waitForSolveResult } from "../../services/scheduleService";

const PHASE_ICONS = {
  "Đang xếp hàng chờ...": "🕐",
  "Đang xếp lịch...":     "⚙️",
  "Hoàn tất!":            "✅",
  "Thất bại":             "❌",
};

export default function SolverProgress({ jobId, onCompleted, onFailed }) {
  const [pct, setPct]     = useState(0);
  const [phase, setPhase] = useState("Đang xếp hàng chờ...");
  const [elapsed, setElapsed] = useState(0);
  const cancelRef = useRef(false);
  const timerRef  = useRef(null);

  // Elapsed timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Poll loop via waitForSolveResult
  useEffect(() => {
    cancelRef.current = false;

    waitForSolveResult(
      jobId,
      (progress, phaseLabel) => {
        if (cancelRef.current) return;
        setPct(Math.max(0, Math.min(100, progress)));
        setPhase(phaseLabel);
      },
      3000
    )
      .then((result) => {
        if (!cancelRef.current) {
          setPct(100);
          setPhase("Hoàn tất!");
          clearInterval(timerRef.current);
          setTimeout(() => onCompleted?.(result), 600);
        }
      })
      .catch((err) => {
        if (!cancelRef.current) {
          setPhase("Thất bại");
          clearInterval(timerRef.current);
          onFailed?.(err);
        }
      });

    return () => {
      cancelRef.current = true;
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const icon = PHASE_ICONS[phase] ?? "⚙️";
  const fmtTime = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="solver-progress-overlay">
      <div className="solver-progress-card">
        {/* Spinner */}
        <div className="sp-spinner-wrap">
          <div className="sp-ring-spinner" />
          <span className="sp-phase-icon">{icon}</span>
        </div>

        {/* Title */}
        <div className="sp-title">Đang xếp lịch tự động</div>
        <div className="sp-job-id">Job: <code>{jobId}</code></div>

        {/* Phase */}
        <div className="sp-phase-label">{phase}</div>

        {/* Progress bar */}
        <div className="sp-bar-wrap">
          <div
            className="sp-bar-fill progress-bar-animated"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="sp-pct-text">{pct}%</div>

        {/* Elapsed */}
        <div className="sp-elapsed">⏱ {fmtTime} đã trôi qua</div>

        <div className="sp-hint">Solver đang tối ưu hóa bằng Tabu Search…</div>
      </div>
    </div>
  );
}
