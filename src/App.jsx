import { useState, useEffect } from "react";
import { NAV_ITEMS } from "./constants/accounts";
import { logout as apiLogout, refresh as apiRefresh } from "./services/authService";
import Header from "./presentation/UI/Header";
import Footer from "./presentation/UI/Footer";
import LoginScreen from "./presentation/UI/LoginScreen";
import GradeForm from "./presentation/UI/GradeForm";
import SchedulingSystem from "./presentation/UI/SchedulingSystem";
import ChangePassword from "./presentation/UI/ChangePassword";
import UserManagement from "./presentation/UI/UserManagement";
import backgroundPattern from "../assets/images/background.png";

export default function App() {
  const [user, setUser] = useState(null);

  // Auto refresh token every 29 minutes (1740000 ms)
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(async () => {
      try {
        await apiRefresh();
        console.log("Token refreshed automatically.");
      } catch (err) {
        console.error("Auto refresh failed, logging out:", err);
        handleLogout();
      }
    }, 1740000);
    return () => clearInterval(intervalId);
  }, [user]);
  const [activePage, setActivePage] = useState("Scheduling");
  const [language, setLanguage] = useState("Vietnamese");

  const normalizeRole = (value) => String(value || "").toLowerCase();
  const visibleNavItems = NAV_ITEMS.filter((item) => item !== "User Guide For Student");
  const getAllowedNavItems = (role) => {
    if (role === "admin") return visibleNavItems;
    if (role === "teacher") return visibleNavItems.filter((item) => item !== "User Management");
    if (role === "student") {
      return visibleNavItems.filter((item) => item !== "User Management" && item !== "Grade");
    }
    return visibleNavItems.filter((item) => item !== "User Management");
  };

  const translateNav = (item, lang) => {
    if (lang === "English") return item;
    const dict = {
      "Grade": "Thông tin",
      "Scheduling": "Xếp lịch",
      "Change password": "Đổi mật khẩu",
      "User Management": "Tạo tài khoản nguoi dung",
      "User Guide For Student": "Hướng dẫn cho Sinh viên"
    };
    return dict[item] || item;
  };

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    const role = normalizeRole(loggedInUser?.role);
    const allowed = getAllowedNavItems(role);
    const preferred = role === "admin" ? "User Management" : "Scheduling";
    setActivePage(allowed.includes(preferred) ? preferred : allowed[0]);
  };

  const handleLogout = () => {
    apiLogout(); // Xóa token khỏi localStorage
    setUser(null);
  };

  // Not logged in → show login screen
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const role = normalizeRole(user?.role);
  const isAdmin = role === "admin";
  const allowedNavItems = getAllowedNavItems(role);

  // Logged in → show main app
  return (
    <div className="page app-shell" style={{ "--page-bg-pattern": `url(${backgroundPattern})` }}>
      <Header language={language} />

      {/* ═══ Navigation ═══ */}
      <nav className="top-nav" aria-label="Main navigation">
        <ul className="nav-list">
          {allowedNavItems.map((item) => (
            <li key={item}>
              <button
                className={`nav-btn${activePage === item ? " nav-btn-active" : ""}`}
                type="button"
                onClick={() => setActivePage(item)}
              >
                {translateNav(item, language)}
              </button>
            </li>
          ))}
        </ul>
        <div className="nav-actions">
          {/* User info */}
          <span style={{ fontSize: "0.85rem", color: "#64748b", marginRight: "8px" }}>
            {user.name || user.username}
          </span>
          <label className="sr-only" htmlFor="language-select">Language</label>
          <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language selection">
            <option value="English">English</option>
            <option value="Vietnamese">Vietnamese</option>
          </select>
          <button className="logout-btn" type="button" onClick={handleLogout}>
            {language === "Vietnamese" ? "Đăng xuất" : "Logout"}
          </button>
        </div>
      </nav>

      {/* ═══ Content ═══ */}
      <main className={`content ${activePage === "Scheduling" ? "content-wide" : ""}`}>
        {activePage === "Grade" && allowedNavItems.includes("Grade") && (
          <GradeForm user={user} language={language} />
        )}
        {activePage === "Scheduling" && allowedNavItems.includes("Scheduling") && (
          <SchedulingSystem user={user} language={language} />
        )}
        {activePage === "Change password" && allowedNavItems.includes("Change password") && (
          <ChangePassword user={user} language={language} />
        )}
        {activePage === "User Management" && isAdmin && allowedNavItems.includes("User Management") && (
          <UserManagement user={user} language={language} />
        )}
      </main>

      <Footer language={language} />
    </div>
  );
}
