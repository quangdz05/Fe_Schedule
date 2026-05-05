import { authHeaders } from "./authService";
import { BASE_URL } from "../data/api/api_config";

/**
 * Tạo danh sách người dùng
 * @param {Array<{ email: string, userName: string, roleName: string }>} users
 */
export async function createUsers(users) {
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("Danh sách người dùng trống.");
  }

  const res = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "accept": "application/json"
    },
    body: JSON.stringify(users)
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message || `Tạo người dùng thất bại (${res.status})`;
    throw new Error(message);
  }

  return data;
}
