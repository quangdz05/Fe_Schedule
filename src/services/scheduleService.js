/**
 * scheduleService.js — v2 API (async job-based workflow)
 * Swagger: /api/schedule/*
 */
import { authHeaders } from "./authService";
import { BASE_URL } from "../data/api/api_config";
import { SolveStatus } from "../constants/enums";

/* ─────────────────────────────────────────────────────────
 * 1. GET /api/schedule/pending-sections
 *    Trả về danh sách course sections chưa được xếp lịch
 * ───────────────────────────────────────────────────────── */
async function handleResponse(res) {
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API Error (${res.status}): ${txt}`);
  }
  const json = await res.json();
  // Nếu có wrapper { success: true, data: ... } thì lấy data
  if (json && Object.prototype.hasOwnProperty.call(json, 'data') && json.success !== undefined) {
    return json.data;
  }
  return json;
}

export async function getPendingSections() {
  const res = await fetch(`${BASE_URL}/api/schedule/pending-sections`, {
    method: "GET",
    headers: { ...authHeaders(), accept: "application/json" },
  });
  return handleResponse(res);
}

/* ─────────────────────────────────────────────────────────
 * 2. POST /api/schedule/solve
 *    Gửi yêu cầu solve → nhận { jobId }
 * ───────────────────────────────────────────────────────── */
export async function solveSchedule(name, courseSectionIds) {
  const body = { name, courseSectionIds };
  const res = await fetch(`${BASE_URL}/api/schedule/solve`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/* ─────────────────────────────────────────────────────────
 * 3. GET /api/schedule/solve/{jobId}
 *    Poll trạng thái job: { status, progress, result, ... }
 * ───────────────────────────────────────────────────────── */
export async function pollSolveStatus(jobId) {
  const res = await fetch(`${BASE_URL}/api/schedule/solve/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: { ...authHeaders(), accept: "application/json" },
  });
  return handleResponse(res);
}

/* ─────────────────────────────────────────────────────────
 * 4. GET /api/schedule/result/{scenarioId}
 *    Load lịch đã lưu từ DB theo scenarioId
 * ───────────────────────────────────────────────────────── */
export async function getScheduleResult(scenarioId) {
  if (!scenarioId) throw new Error("Thiếu scenarioId để lấy kết quả.");
  const res = await fetch(`${BASE_URL}/api/schedule/result/${encodeURIComponent(scenarioId)}`, {
    method: "GET",
    headers: { ...authHeaders(), accept: "application/json" },
  });
  return handleResponse(res);
}

/* ─────────────────────────────────────────────────────────
 * 5. POST /api/schedule/evaluate-move
 *    Đánh giá drag-drop trước khi commit
 * ───────────────────────────────────────────────────────── */
export async function evaluateMove(sessionId, moves) {
  const body = { sessionId, moves };
  const res = await fetch(`${BASE_URL}/api/schedule/evaluate-move`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/* ─────────────────────────────────────────────────────────
 * 6. POST /api/schedule/hover-lesson
 *    Lấy chi tiết lesson khi hover (multi-teacher, conflicts)
 * ───────────────────────────────────────────────────────── */
export async function getLessonDetail(sessionId, lessonId) {
  const body = { sessionId, lessonId };
  const res = await fetch(`${BASE_URL}/api/schedule/hover-lesson`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/* ─────────────────────────────────────────────────────────
 * 7. POST /api/schedule/sessions/{sessionId}/save
 *    Lưu lịch từ memory vào DB
 * ───────────────────────────────────────────────────────── */
export async function saveSession(sessionId) {
  if (!sessionId) throw new Error("Thiếu sessionId để lưu.");
  const res = await fetch(`${BASE_URL}/api/schedule/sessions/${encodeURIComponent(sessionId)}/save`, {
    method: "POST",
    headers: { ...authHeaders(), accept: "application/json" },
  });
  return handleResponse(res).catch(() => ({ success: true }));
}

/* ─────────────────────────────────────────────────────────
 * HELPER: waitForSolveResult
 * Poll mỗi 3s cho đến khi status = Completed / Failed
 * onProgress(pct: number, phase: string) được gọi mỗi lần poll
 * ───────────────────────────────────────────────────────── */
const PHASE_LABELS = {
  [SolveStatus.Queued]:    "Đang xếp hàng chờ...",
  [SolveStatus.Running]:   "Đang xếp lịch...",
  [SolveStatus.Completed]: "Hoàn tất!",
  [SolveStatus.Failed]:    "Thất bại",
};

export function waitForSolveResult(jobId, onProgress, intervalMs = 3000) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const data = await pollSolveStatus(jobId);
        const status = data.status ?? data.Status;
        const pct = data.progress ?? data.Progress ?? 0;
        const phase = PHASE_LABELS[status] ?? "Đang xử lý...";

        if (typeof onProgress === "function") onProgress(pct, phase);

        if (status === SolveStatus.Completed) return resolve(data);
        if (status === SolveStatus.Failed)
          return reject(new Error(data.error ?? data.message ?? "Solver thất bại"));

        setTimeout(poll, intervalMs);
      } catch (err) {
        reject(err);
      }
    };
    poll();
  });
}
