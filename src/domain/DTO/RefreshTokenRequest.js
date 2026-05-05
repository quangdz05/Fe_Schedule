class RefreshTokenRequest {
  constructor({
    accessToken = "",
    refreshToken = ""
  } = {}) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}

export default RefreshTokenRequest;
