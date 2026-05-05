class AuthResponse {
  constructor({
    accessToken = "",
    refreshToken = "",
    expiresAtUtc = null,
    userName = "",
    email = "",
    roles = []
  } = {}) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAtUtc = expiresAtUtc; // có thể là Date hoặc string ISO
    this.userName = userName;
    this.email = email;
    this.roles = roles;
  }
}

export default AuthResponse;