import { useState } from "react";
import { createUsers } from "../../services/userService";

const defaultRow = { email: "", userName: "", roleName: "Student" };

const normalizeRole = (value) => String(value || "").toLowerCase();

export default function UserManagement({ user, language = "Vietnamese" }) {
  const isVi = language === "Vietnamese";
  const isAdmin = normalizeRole(user?.role) === "admin";

  const [rows, setRows] = useState([{ ...defaultRow }]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const t = {
    title: isVi ? "Tao tai khoan nguoi dung" : "Create user accounts",
    subtitle: isVi ? "Chi admin moi co quyen tao tai khoan" : "Only admin can create accounts",
    email: "Email",
    username: isVi ? "Ten dang nhap" : "Username",
    role: isVi ? "Vai tro" : "Role",
    addRow: isVi ? "Them dong" : "Add row",
    removeRow: isVi ? "Xoa dong" : "Remove row",
    submit: isVi ? "Tao tai khoan" : "Create accounts",
    empty: isVi ? "Vui long nhap day du thong tin." : "Please fill in all fields.",
    success: isVi ? "Tao tai khoan thanh cong." : "Accounts created successfully.",
    noPermission: isVi ? "Ban khong co quyen tao tai khoan." : "You do not have permission to create accounts.",
  };

  const updateRow = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { ...defaultRow }]);
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setOutput("");

    if (!isAdmin) {
      setMessage({ type: "error", text: t.noPermission });
      return;
    }

    const payload = rows
      .map((row) => ({
        email: row.email.trim(),
        userName: row.userName.trim(),
        roleName: row.roleName.trim()
      }))
      .filter((row) => row.email || row.userName || row.roleName);

    if (payload.length === 0) {
      setMessage({ type: "error", text: t.empty });
      return;
    }

    const invalidRow = payload.find((row) => !row.email || !row.userName || !row.roleName);
    if (invalidRow) {
      setMessage({ type: "error", text: t.empty });
      return;
    }

    setIsLoading(true);
    try {
      const data = await createUsers(payload);
      setMessage({ type: "success", text: t.success });
      setOutput(typeof data === "string" ? data : JSON.stringify(data, null, 2));
      setRows([{ ...defaultRow }]);
    } catch (err) {
      setMessage({ type: "error", text: err.message || t.empty });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="user-mgmt" aria-label="User management">
        <div className="user-card">
          <h3>{t.title}</h3>
          <p className="user-muted">{t.noPermission}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="user-mgmt" aria-label="User management">
      <div className="user-card">
        <div className="user-card-header">
          <div>
            <h3>{t.title}</h3>
            <p className="user-muted">{t.subtitle}</p>
          </div>
        </div>

        <form className="user-form" onSubmit={handleSubmit}>
          <div className="user-rows">
            {rows.map((row, index) => (
              <div key={`user-row-${index}`} className="user-row">
                <div className="user-field">
                  <label>{t.email}</label>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateRow(index, "email", e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="user-field">
                  <label>{t.username}</label>
                  <input
                    type="text"
                    value={row.userName}
                    onChange={(e) => updateRow(index, "userName", e.target.value)}
                    placeholder="username"
                  />
                </div>
                <div className="user-field">
                  <label>{t.role}</label>
                  <select
                    value={row.roleName}
                    onChange={(e) => updateRow(index, "roleName", e.target.value)}
                  >
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="user-field user-actions">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="user-btn secondary"
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                  >
                    {t.removeRow}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="user-buttons">
            <button type="button" className="user-btn secondary" onClick={addRow}>
              {t.addRow}
            </button>
            <button type="submit" className="user-btn" disabled={isLoading}>
              {isLoading ? "..." : t.submit}
            </button>
          </div>
        </form>

        {message.text && (
          <div className={`user-message ${message.type}`}>{message.text}</div>
        )}
        {output && <pre className="user-output">{output}</pre>}
      </div>
    </section>
  );
}
