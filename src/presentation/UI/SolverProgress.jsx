import { useEffect, useRef, useState } from "react";
import { pollSolveStatus } from "../../services/scheduleService";
import { SolveStatus } from "../../constants/enums";

export default function SolverProgress({ jobId, onCompleted, onFailed }) {
  const [pct, setPct] = useState(0);             // Mốc đích thực tế
  const [displayPct, setDisplayPct] = useState(0); // Số hiển thị chạy mượt trên UI
  const [phase, setPhase] = useState("Đang khởi tạo...");
  const [dots, setDots] = useState(0);
  const stopRef = useRef(false);
  const pollTimerRef = useRef(null);
  const finishTimerRef = useRef(null);
  const completedRef = useRef(false);
  const onCompletedRef = useRef(onCompleted);
  const onFailedRef = useRef(onFailed);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
    onFailedRef.current = onFailed;
  }, [onCompleted, onFailed]);

  // 1. Animated dots (Hiển thị dấu chấm chạy ...)
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  // 2. 🔥 Tự động ước lượng tăng từ từ lên 100% (Chạy độc lập mượt mà)
  useEffect(() => {
    let timer;
    
    // Nếu chưa có kết quả cuối cùng từ Backend (pct < 100)
    if (pct < 100) {
      if (displayPct < 95) {
        // Tự động nhích dần từng chút một dựa theo thời gian ước tính (khoảng 50 giây)
        timer = setTimeout(() => {
          setDisplayPct((prev) => prev + 1);
        }, 500); // 500ms tăng 1% -> mất khoảng 47.5 giây để lên tới 95%
      }
    } 
    // Khi Backend đã báo COMPLETED thực sự (pct === 100)
    else if (pct === 100 && displayPct < 100) {
      // Ép số chạy nhanh tốc độ cao để lấp đầy lên 100%
      timer = setTimeout(() => {
        setDisplayPct((prev) => prev + 1);
      }, 20); // 20ms tăng 1% để cán đích thật nhanh
    }

    return () => clearTimeout(timer);
  }, [displayPct, pct]);


  // 3. Quản lý trạng thái chữ hiển thị (Phase label) theo mức tăng của displayPct
  useEffect(() => {
    if (pct === 100 && displayPct === 100) {
      setPhase("Hoàn tất!");
      return;
    }
    
    if (displayPct === 0) setPhase("Đang khởi tạo");
    else if (displayPct < 30) setPhase("Phân tích dữ liệu");
    else if (displayPct < 75) setPhase("Đang xếp lịch");
    else if (displayPct < 98) setPhase("Tối ưu hóa");
  }, [displayPct, pct]);


  // 4. Poll trạng thái job cho đến khi backend báo Completed hoặc Failed.
  useEffect(() => {
    if (!jobId) return;
    stopRef.current = false;
    completedRef.current = false;
    setPct(0);
    setDisplayPct(0);
    setPhase("Đang khởi tạo");

    const clearTimers = () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (finishTimerRef.current) clearInterval(finishTimerRef.current);
      pollTimerRef.current = null;
      finishTimerRef.current = null;
    };

    const finish = (result) => {
      if (completedRef.current || stopRef.current) return;
      completedRef.current = true;
      setPct(100);

      finishTimerRef.current = setInterval(() => {
        if (stopRef.current) {
          clearTimers();
          return;
        }
        setDisplayPct((currentDisplay) => {
          if (currentDisplay >= 100) {
            clearTimers();
            onCompletedRef.current?.(result);
          }
          return currentDisplay;
        });
      }, 50);
    };

    const tick = async () => {
      if (stopRef.current) return;
      try {
        const result = await pollSolveStatus(jobId);
        if (stopRef.current || completedRef.current) return;

        const status = result?.status ?? "";
        const nextPct = result?.progressPercent ?? result?.progress?.percentage ?? result?.progress ?? 0;
        if (typeof nextPct === "number") {
          setPct((prev) => Math.max(prev, Math.min(nextPct, 99)));
        }
        
        if (status === SolveStatus.Completed || status === "Completed") {
          finish(result);
          return;
        }

        if (status === SolveStatus.Failed || status === "Failed") {
          completedRef.current = true;
          onFailedRef.current?.(new Error(result?.error || "Solver thất bại."));
          return;
        }

        pollTimerRef.current = setTimeout(tick, 1500);
      } catch (err) {
        if (stopRef.current || completedRef.current) return;
        completedRef.current = true;
        onFailedRef.current?.(err);
      }
    };

    tick();
    return () => {
      stopRef.current = true;
      clearTimers();
    };
  }, [jobId]);

  return (
    <div className="solver-progress-overlay">
      <div className="solver-progress-card">
        <div className="sp-spinner-ring" />
        <div className="sp-info">
          <div className="sp-phase">
            {phase}{"...".slice(0, dots + 1)}
          </div>
          <div className="sp-pct-label">{displayPct}%</div>
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-animated"
            style={{ width: `${displayPct}%` }}
          />
        </div>
        <div className="sp-steps">
          {["Khởi tạo", "Phân tích", "Xếp lịch", "Tối ưu", "Hoàn tất"].map((step, i) => {
            const threshold = i * 25;
            const done = displayPct >= threshold + 20;
            const active = displayPct >= threshold && !done;
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
