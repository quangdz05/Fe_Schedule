class RegisterRequest {
  constructor({
    email = "",
    userName = "",
    password = "",
    confirmPassword = ""
  } = {}) {
    this.email = email;
    this.userName = userName;
    this.password = password;
    this.confirmPassword = confirmPassword;
  }
}

export default RegisterRequest;
