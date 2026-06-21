import { authHeaders } from "./authService";
import { BASE_URL } from "../data/api/api_config";

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

// ─── CRUD Semesters ────────────────────────────────────────────────────────
export async function getAllSemesters() {
  return apiFetch("/api/semesters");
}

export async function getActiveSemester() {
  return apiFetch("/api/semesters/active");
}

export async function getSemesterById(id) {
  return apiFetch(`/api/semesters/${id}`);
}

export async function createSemester(data) {
  return apiFetch("/api/semesters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSemester(id, data) {
  return apiFetch(`/api/semesters/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
