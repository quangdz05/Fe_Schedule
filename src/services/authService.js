import AuthResponse from "../domain/DTO/AuthResponse";
import RegisterRequest from "../domain/DTO/RegisterRequest";
import RefreshTokenRequest from "../domain/DTO/RefreshTokenRequest";
import { BASE_URL } from "../data/api/api_config";

/* ═══════════════════════════════════════════
   Auth Service – Kết nối API Backend
   ═══════════════════════════════════════════ */

/**
 * Đăng ký tài khoản mới
 * @param {{ email: string, userName: string, password: string, confirmPassword: string }} data
 * @returns {Promise<object>} response từ server
 */
export async function register(registerData) {
  const request = new RegisterRequest(registerData);
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data?.message ||
      data?.errors?.map((e) => e.description).join(", ") ||
      `Đăng ký thất bại (${res.status})`;
    throw new Error(message);
  }

  return data;
}

/**
 * Đăng nhập
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<object>} { token, user, ... }
 */
export async function login({ email, password }) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const rawData = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      rawData?.message || `Đăng nhập thất bại (${res.status})`;
    throw new Error(message);
  }

  // Map dữ liệu từ API sang DTO
  const data = new AuthResponse(rawData);

  // Lưu token vào localStorage nếu server trả về
  if (data?.accessToken) {
    localStorage.setItem("authToken", data.accessToken);
  }
  if (data?.refreshToken) {
    localStorage.setItem("refreshToken", data.refreshToken);
  }

  return data;
}

/**
 * Đăng xuất – xóa token
 */
export function logout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("refreshToken");
}

/**
 * Lấy token hiện tại
 * @returns {string|null}
 */
export function getToken() {
  return localStorage.getItem("authToken");
}

/**
 * Làm mới token
 * @returns {Promise<AuthResponse>}
 */
export async function refresh({ accessToken: accessTokenOverride, refreshToken: refreshTokenOverride } = {}) {
  const accessToken = accessTokenOverride || getToken();
  const refreshToken = refreshTokenOverride || getRefreshToken();

  if (!accessToken || !refreshToken) {
    throw new Error("Không tìm thấy token để làm mới.");
  }

  const request = new RefreshTokenRequest({ accessToken, refreshToken });

  const res = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const rawData = await res.json().catch(() => null);

  if (!res.ok) {
    logout();
    const message = rawData?.message || `Làm mới token thất bại (${res.status})`;
    throw new Error(message);
  }

  const data = new AuthResponse(rawData);

  if (data?.accessToken) {
    localStorage.setItem("authToken", data.accessToken);
  }
  if (data?.refreshToken) {
    localStorage.setItem("refreshToken", data.refreshToken);
  }

  return data;
}

/**
 * Đổi mật khẩu
 * @param {{ oldPassword: string, newPassword: string }} payload
 * @returns {Promise<object>}
 */
export async function changePassword({ oldPassword, newPassword }) {
  const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message || `Đổi mật khẩu thất bại (${res.status})`;
    throw new Error(message);
  }

  return data;
}

/**
 * Lấy refresh token hiện tại
 * @returns {string|null}
 */
export function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

/**
 * Tạo headers có Authorization cho các API khác
 * @returns {object}
 */
export function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
