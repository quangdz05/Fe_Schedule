import { useState } from "react";
import { changePassword as apiChangePassword } from "../../services/authService";

export default function ChangePassword({ user, language }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const t = {
    username: language === "Vietnamese" ? "Tên đăng nhập" : "Username",
    fullName: language === "Vietnamese" ? "Họ và tên" : "Full Name",
    oldPassword: language === "Vietnamese" ? "Mật khẩu cũ" : "Old password",
    newPassword: language === "Vietnamese" ? "Mật khẩu mới" : "New password",
    confirmPassword: language === "Vietnamese" ? "Xác nhận mật khẩu" : "Confirm password",
    btnSubmit: language === "Vietnamese" ? "Đổi mật khẩu" : "Change password",
    errEmpty: language === "Vietnamese" ? "Vui lòng nhập đầy đủ các trường." : "Please fill in all password fields.",
    errMatch: language === "Vietnamese" ? "Mật khẩu mới không khớp." : "New passwords do not match.",
    errOld: language === "Vietnamese" ? "Mật khẩu cũ không chính xác." : "Old password is incorrect.",
    success: language === "Vietnamese" ? "Đổi mật khẩu thành công!" : "Password changed successfully!",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: t.errEmpty });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: t.errMatch });
      return;
    }
    
    setIsLoading(true);
    try {
      await apiChangePassword({ oldPassword, newPassword });
      setMessage({ type: "success", text: t.success });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMessage({ type: "error", text: err.message || t.errOld });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cp-container">
      <form className="cp-form" onSubmit={handleSubmit}>
        <div className="cp-row">
          <label>{t.username}</label>
          <input type="text" value={user.username} disabled className="cp-input" />
        </div>
        
        <div className="cp-row">
          <label>{t.fullName}</label>
          <input type="text" value={user.name} disabled className="cp-input" />
        </div>
        
        <div className="cp-row cp-margin-top">
          <label htmlFor="oldPassword">{t.oldPassword}</label>
          <input 
            type="password" 
            id="oldPassword"
            value={oldPassword} 
            onChange={(e) => setOldPassword(e.target.value)} 
            className="cp-input"
          />
        </div>
        
        <div className="cp-row">
          <label htmlFor="newPassword">{t.newPassword}</label>
          <input 
            type="password" 
            id="newPassword"
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            className="cp-input"
          />
        </div>
        
        <div className="cp-row">
          <label htmlFor="confirmPassword">{t.confirmPassword}</label>
          <input 
            type="password" 
            id="confirmPassword"
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)} 
            className="cp-input"
          />
        </div>

        <div className="cp-actions">
          <button type="submit" className="cp-btn" disabled={isLoading}>
            {isLoading ? "..." : t.btnSubmit}
          </button>
        </div>

        {message.text && (
          <div className={`cp-message ${message.type}`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}
