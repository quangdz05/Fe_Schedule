import { authHeaders } from "./authService";
import { BASE_URL } from "../data/api/api_config";

// ─── Shared fetch helper (reuse pattern from scheduleService) ──────────────
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

  if (res.status === 204) return null;
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "success" in json) {
    return json.data;
  }
  return json;
}

// ─── Profile ───────────────────────────────────────────────────────────────
export async function getProfile() {
  return apiFetch("/api/lecturer/me/profile");
}

// ─── Schedules ─────────────────────────────────────────────────────────────
export async function getMySchedules() {
  return apiFetch("/api/lecturer/me/schedule");
}

export async function getMyScheduleDetail(scheduleId) {
  return apiFetch(`/api/lecturer/me/schedule/${scheduleId}`);
}

// ─── Constraints ───────────────────────────────────────────────────────────
export async function getMyConstraints() {
  return apiFetch("/api/lecturer/me/constraints");
}

export async function registerConstraint(data) {
  return apiFetch("/api/lecturer/me/constraints", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteConstraint(id) {
  return apiFetch(`/api/lecturer/me/constraints/${id}`, {
    method: "DELETE",
  });
}

// ─── Available Windows ────────────────────────────────────────────────────
export async function getMyAvailableWindows() {
  return apiFetch("/api/lecturer/me/available-windows");
}

export async function registerAvailableWindow(data) {
  return apiFetch("/api/lecturer/me/available-windows", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAvailableWindow(id) {
  return apiFetch(`/api/lecturer/me/available-windows/${id}`, {
    method: "DELETE",
  });
}

// ─── TimeSlots ─────────────────────────────────────────────────────────────
export async function getTimeSlots() {
  return apiFetch("/api/lecturer/me/timeslots");
}
