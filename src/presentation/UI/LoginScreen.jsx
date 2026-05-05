import { useState } from "react";
import { login as apiLogin } from "../../services/authService";
import Header from "./Header";
import Footer from "./Footer";
import backgroundPattern from "../../../assets/images/background.png";

export default function LoginScreen({ onLogin }) {
  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState("Vietnamese");

  const t = {
    email: "Email",
    username: language === "Vietnamese" ? "Tên đăng nhập" : "Username",
    password: language === "Vietnamese" ? "Mật khẩu" : "Password",
    btnLogin: language === "Vietnamese" ? "Đăng nhập" : "Login",
    btnLoading: language === "Vietnamese" ? "Đang xử lý..." : "Processing...",
    errEmpty: language === "Vietnamese" ? "Vui lòng điền đầy đủ thông tin." : "Please fill in all fields.",
    errInvalid: language === "Vietnamese" ? "Email hoặc mật khẩu không đúng." : "Invalid email or password.",
    loginTitle: language === "Vietnamese" ? "Đăng nhập hệ thống" : "System Login",
  };

  /* ═══ Handle Login ═══ */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError(t.errEmpty);
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiLogin({ email: email.trim(), password });
      const rawRole = Array.isArray(data.roles) && data.roles.length > 0 ? data.roles[0] : "student";
      const numericRole = Number.isInteger(rawRole)
        ? rawRole
        : /^\d+$/.test(String(rawRole))
        ? Number(rawRole)
        : null;
      const normalizedRole = String(rawRole || "student").toLowerCase();
      const resolvedRole = numericRole === 0
        ? "admin"
        : numericRole === 1
        ? "teacher"
        : numericRole === 2
        ? "student"
        : normalizedRole.includes("admin")
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

      {/* ═══ Login Form ═══ */}
      <main className="content login-content">
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

          <div className="login-actions">
            <button className="login-submit-btn" type="submit" disabled={isLoading} id="btn-login">
              {isLoading ? t.btnLoading : t.btnLogin}
            </button>
          </div>
        </form>
      </main>

      <Footer language={language} />
    </div>
  );
}
