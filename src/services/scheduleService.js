import { authHeaders } from "./authService";
import { BASE_URL } from "../data/api/api_config";
import { SolveRequest, EvaluateMoveRequest, LessonDetailRequest } from "../domain/DTO/ScheduleScenarioRequest";
import { SolveStatus } from "../constants/enums";

// ─── Shared fetch helper ───────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      msg = errBody?.message || errBody?.title || JSON.stringify(errBody);
    } catch {
      msg = (await res.text()) || msg;
    }
    throw new Error(msg);
  }

  // 204 No Content
  if (res.status === 204) return null;

  const json = await res.json();

  // Backend wraps every response in { success, data, message }.
  // Unwrap automatically so callers get the real payload.
  if (json && typeof json === "object" && "data" in json && "success" in json) {
    return json.data;
  }
  return json;
}

// ─── 1. GET /api/schedule/pending-sections ────────────────────────────────
/**
 * Lấy danh sách course sections chưa có lịch.
 * @returns {Promise<Array>} mảng PendingSection objects từ API
 */
export async function getPendingSections() {
  const res = await apiFetch("/api/schedule/pending-sections");
  if (!res) return [];

  // Dang 1: mang truc tiep
  if (Array.isArray(res)) return res;

  // Dang 2 (backend chuan): { success, data: { items: [...] } }
  if (res.data?.items && Array.isArray(res.data.items)) return res.data.items;

  // Dang 3: { data: [...] }
  if (Array.isArray(res.data)) return res.data;

  // Dang 4: { items: [...] } phang
  if (Array.isArray(res.items)) return res.items;

  // Last resort: tim key dau tien la array
  const firstArr = Object.values(res).find(v => Array.isArray(v));
  if (firstArr) return firstArr;

  // Neu res.data la object co items
  if (res.data && typeof res.data === "object") {
    const nested = Object.values(res.data).find(v => Array.isArray(v));
    if (nested) return nested;
  }

  return [];
}

// ─── 2. POST /api/schedule/solve ──────────────────────────────────────────
/**
 * Gửi yêu cầu solve, nhận jobId ngay lập tức (async).
 * @param {string} name - tên kịch bản
 * @param {number[]} courseSectionIds - danh sách IDs sections cần xếp
 * @returns {Promise<{ jobId: string }>}
 */
export async function solveSchedule(name, courseSectionIds) {
  const body = new SolveRequest({ name, courseSectionIds });
  return apiFetch("/api/schedule/solve", {

    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── 3. GET /api/schedule/solve/{jobId} ──────────────────────────────────
/**
 * Poll trạng thái job.
 * @returns {Promise<{ status: string, progressPercent: number, schedule?: object, hardScore?: number, softScore?: number }>}
 */
export async function pollSolveStatus(jobId) {
  return apiFetch(`/api/schedule/solve/${jobId}`);
}

// ─── 4. GET /api/schedule/result/{scenarioId} ────────────────────────────
/**
 * Load lịch đã lưu từ DB theo scenarioId.
 * @returns {Promise<{ schedule: object, hardScore: number, softScore: number }>}
 */
export async function getScheduleResult(scenarioId) {
  if (!scenarioId) throw new Error("Thiếu scenarioId.");
  return apiFetch(`/api/schedule/result/${scenarioId}`);
}

// ─── 5. POST /api/schedule/evaluate-move ────────────────────────────────
/**
 * Đánh giá drag-drop trước khi commit.
 * @param {string} sessionId
 * @param {{ lessonId: number, newTimeSlotId: number|null, newRoomId: number|null }[]} moves
 * @returns {Promise<{ deltaHardScore: number, deltaSoftScore: number, addedConflicts: object[], resolvedConflicts: object[] }>}
 */
export async function evaluateMove(sessionId, moves) {
  const body = new EvaluateMoveRequest({ sessionId, moves });
  return apiFetch("/api/schedule/evaluate-move", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── 6. POST /api/schedule/hover-lesson ─────────────────────────────────
/**
 * Lấy chi tiết lesson khi hover (multi-teacher, conflicts...).
 * @returns {Promise<object>} lesson detail DTO
 */
export async function getLessonDetail(sessionId, lessonId) {
  const body = new LessonDetailRequest({ sessionId, lessonId });
  return apiFetch("/api/schedule/hover-lesson", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── 7. POST /api/schedule/sessions/{id}/save ────────────────────────────
/**
 * Lưu lịch từ memory vào DB.
 * @param {string} sessionId
 * @returns {Promise<null|object>}
 */
export async function saveSession(sessionId) {
  if (!sessionId) throw new Error("Thiếu sessionId.");
  return apiFetch(`/api/schedule/sessions/${sessionId}/save`, {
    method: "POST",
  });
}

// ─── Helper: Poll cho đến khi hoàn thành ─────────────────────────────────
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 120; // 6 phút max

/**
 * Poll solve status cho đến khi Completed hoặc Failed.
 * @param {string} jobId
 * @param {function(pct: number, phase: string): void} onProgress - callback mỗi lần poll
 * @returns {Promise<{ schedule: object, hardScore: number, softScore: number }>}
 */
export function waitForSolveResult(jobId, onProgress) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const phaseLabel = (status, pct) => {
      if (pct === 0 || status === SolveStatus.Queued) return "Đang khởi tạo...";
      if (status === SolveStatus.Running && pct < 50) return "Đang phân tích dữ liệu...";
      if (status === SolveStatus.Running) return "Đang xếp lịch...";
      if (status === SolveStatus.Completed) return "Hoàn tất!";
      return "Đang xử lý...";
    };

    const tick = async () => {
      attempts++;
      if (attempts > MAX_POLL_ATTEMPTS) {
        return reject(new Error("Timeout: Solver mất quá nhiều thời gian."));
      }

      try {
        const result = await pollSolveStatus(jobId);
        const status = result?.status ?? "";
        const pct = result?.progressPercent ?? result?.progress ?? 0;

        if (typeof onProgress === "function") {
          onProgress(pct, phaseLabel(status, pct));
        }

        if (status === SolveStatus.Completed) {
          return resolve(result);
        }
        if (status === SolveStatus.Failed) {
          return reject(new Error(result?.error || "Solver thất bại."));
        }

        setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        reject(err);
      }
    };

    tick();
  });
}
