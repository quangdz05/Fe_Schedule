import { useState } from "react";
import { login as apiLogin, register as apiRegister } from "../../services/authService";
import Header from "./Header";
import Footer from "./Footer";
import backgroundPattern from "../../../assets/images/background.png";

export default function LoginScreen({ onLogin }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register fields
  const [regEmail, setRegEmail] = useState("");
  const [regUserName, setRegUserName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState("Vietnamese");

  const t = {
    email: "Email",
    username: language === "Vietnamese" ? "Tên đăng nhập" : "Username",
    password: language === "Vietnamese" ? "Mật khẩu" : "Password",
    confirmPassword: language === "Vietnamese" ? "Xác nhận mật khẩu" : "Confirm Password",
    btnLogin: language === "Vietnamese" ? "Đăng nhập" : "Login",
    btnRegister: language === "Vietnamese" ? "Đăng ký" : "Register",
    btnLoading: language === "Vietnamese" ? "Đang xử lý..." : "Processing...",
    errEmpty: language === "Vietnamese" ? "Vui lòng điền đầy đủ thông tin." : "Please fill in all fields.",
    errInvalid: language === "Vietnamese" ? "Email hoặc mật khẩu không đúng." : "Invalid email or password.",
    errPasswordMismatch: language === "Vietnamese" ? "Mật khẩu xác nhận không khớp." : "Passwords do not match.",
    successRegister: language === "Vietnamese" ? "Đăng ký thành công! Vui lòng đăng nhập." : "Registration successful! Please login.",
    switchToRegister: language === "Vietnamese" ? "Chưa có tài khoản? Đăng ký" : "Don't have an account? Register",
    switchToLogin: language === "Vietnamese" ? "Đã có tài khoản? Đăng nhập" : "Already have an account? Login",
    loginTitle: language === "Vietnamese" ? "Đăng nhập hệ thống" : "System Login",
    registerTitle: language === "Vietnamese" ? "Tạo tài khoản mới" : "Create New Account",
  };

  /* ═══ Handle Login ═══ */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password.trim()) {
      setError(t.errEmpty);
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiLogin({ email: email.trim(), password });
      const rawRole = Array.isArray(data.roles) && data.roles.length > 0 ? data.roles[0] : "student";
      const normalizedRole = String(rawRole || "student").toLowerCase();
      const resolvedRole = normalizedRole.includes("admin")
        ? "admin"
        : normalizedRole.includes("teacher") || normalizedRole.includes("lecturer")
        ? "teacher"
        : normalizedRole.includes("student")
        ? "student"
        : normalizedRole;

      onLogin({
        username: data.userName || data.email || email,
        name: data.userName || email,
        email: data.email || email,
        role: resolvedRole,
        token: data.accessToken,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /* ═══ Handle Register ═══ */
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!regEmail.trim() || !regUserName.trim() || !regPassword || !regConfirmPassword) {
      setError(t.errEmpty);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError(t.errPasswordMismatch);
      return;
    }

    setIsLoading(true);

    try {
      await apiRegister({
        email: regEmail.trim(),
        userName: regUserName.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
      });
      setSuccess(t.successRegister);
      setIsRegisterMode(false);
      // Pre-fill login form
      setEmail(regEmail.trim());
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page" style={{ "--page-bg-pattern": `url(${backgroundPattern})` }}>
      <Header language={language} />

      {/* ═══ Nav ═══ */}
      <nav className="top-nav" aria-label="Language selection">
        <div className="nav-center">
          <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language selection" className="login-lang-select">
            <option value="English">English</option>
            <option value="Vietnamese">Vietnamese</option>
          </select>
        </div>
      </nav>

      {/* ═══ Login / Register Form ═══ */}
      <main className="content login-content">
        {!isRegisterMode ? (
          /* ── LOGIN FORM ── */
          <form className="login-card" onSubmit={handleLogin} id="login-form">
            <h2 style={{ textAlign: "center", marginBottom: "16px", color: "#1e40af", fontSize: "1.3rem" }}>
              {t.loginTitle}
            </h2>

            <div className="login-field">
              <label htmlFor="login-email">{t.email}</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                placeholder="user@example.com"
              />
            </div>
            <div className="login-field">
              <label htmlFor="login-password">{t.password}</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <div className="login-error">{error}</div>}
            {success && <div className="login-error" style={{ color: "#16a34a", borderColor: "#bbf7d0", background: "#f0fdf4" }}>{success}</div>}

            <div className="login-actions">
              <button className="login-submit-btn" type="submit" disabled={isLoading} id="btn-login">
                {isLoading ? t.btnLoading : t.btnLogin}
              </button>
            </div>

            {/* Switch to Register */}
            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => { setIsRegisterMode(true); setError(""); setSuccess(""); }}
                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline", fontSize: "0.9rem" }}
              >
                {t.switchToRegister}
              </button>
            </div>
          </form>
        ) : (
          /* ── REGISTER FORM ── */
          <form className="login-card" onSubmit={handleRegister} id="register-form">
            <h2 style={{ textAlign: "center", marginBottom: "16px", color: "#1e40af", fontSize: "1.3rem" }}>
              {t.registerTitle}
            </h2>

            <div className="login-field">
              <label htmlFor="reg-email">{t.email}</label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                placeholder="user@example.com"
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-username">{t.username}</label>
              <input
                id="reg-username"
                type="text"
                value={regUserName}
                onChange={(e) => setRegUserName(e.target.value)}
                autoComplete="username"
                placeholder="TestUser"
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-password">{t.password}</label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Password123!"
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-confirm-password">{t.confirmPassword}</label>
              <input
                id="reg-confirm-password"
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <div className="login-actions">
              <button className="login-submit-btn" type="submit" disabled={isLoading} id="btn-register">
                {isLoading ? t.btnLoading : t.btnRegister}
              </button>
            </div>

            {/* Switch back to Login */}
            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => { setIsRegisterMode(false); setError(""); }}
                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline", fontSize: "0.9rem" }}
              >
                {t.switchToLogin}
              </button>
            </div>
          </form>
        )}
      </main>

      <Footer language={language} />
    </div>
  );
}
