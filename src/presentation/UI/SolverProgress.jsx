import { useEffect, useRef, useState } from "react";
import { pollSolveStatus } from "../../services/scheduleService";
import { SolveStatus } from "../../constants/enums";

/**
 * SolverProgress — overlay hiển thị tiến trình solve.
 * Props:
 *   jobId                      — job đang poll
 *   onCompleted(result)        — gọi khi Completed
 *   onFailed(error)            — gọi khi Failed
 */
export default function SolverProgress({ jobId, onCompleted, onFailed }) {
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState("Đang khởi tạo...");
  const [dots, setDots] = useState(0);
  const stopRef = useRef(false);

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    stopRef.current = false;
    const INTERVAL = 5000;

    const phaseLabel = (status, progress) => {
      if (status === SolveStatus.Queued || progress === 0) return "Đang khởi tạo";
      if (status === SolveStatus.Running && progress < 30) return "Phân tích dữ liệu";
      if (status === SolveStatus.Running && progress < 70) return "Đang xếp lịch";
      if (status === SolveStatus.Running) return "Tối ưu hóa";
      if (status === SolveStatus.Completed) return "Hoàn tất!";
      return "Đang xử lý";
    };

    const tick = async () => {
      if (stopRef.current) return;
      try {
        const result = await pollSolveStatus(jobId);
        const status = result?.status ?? "";
        // Backend: progress is nested { percentage, phase, iteration, maxIterations }
        const progressObj = result?.progress;
        const progress = progressObj?.percentage ?? progressObj ?? 0;

        setPct(progress);
        setPhase(phaseLabel(status, progress));

        if (status === SolveStatus.Completed) {
          setPct(100);
          setPhase("Hoàn tất!");
          onCompleted?.(result);
          return;
        }
        if (status === SolveStatus.Failed) {
          onFailed?.(new Error(result?.error || "Solver thất bại."));
          return;
        }

        if (!stopRef.current) {
          setTimeout(tick, INTERVAL);
        }
      } catch (err) {
        onFailed?.(err);
      }
    };

    tick();
    return () => { stopRef.current = true; };
  }, [jobId]);

  return (
    <div className="solver-progress-overlay">
      <div className="solver-progress-card">
        <div className="sp-spinner-ring" />
        <div className="sp-info">
          <div className="sp-phase">
            {phase}{"...".slice(0, dots + 1)}
          </div>
          <div className="sp-pct-label">{pct}%</div>
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-animated"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="sp-steps">
          {["Khởi tạo", "Phân tích", "Xếp lịch", "Tối ưu", "Hoàn tất"].map((step, i) => {
            const threshold = i * 25;
            const done = pct >= threshold + 20;
            const active = pct >= threshold && !done;
            return (
              <div key={step} className={`sp-step ${done ? "done" : active ? "active" : ""}`}>
                <div className="sp-step-dot" />
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
