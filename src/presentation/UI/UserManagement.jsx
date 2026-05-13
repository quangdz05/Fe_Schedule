import { useState } from "react";
import * as XLSX from "xlsx";
import { createUsers } from "../../services/userService";

const defaultRow = { email: "", userName: "", roleName: "Student" };

const normalizeRole = (value) => String(value || "").toLowerCase();
const roleOptions = [
  { value: "Admin", code: 0 },
  { value: "Teacher", code: 1 },
  { value: "Student", code: 2 },
];

const roleNameToCode = (value) => {
  const mapped = mapRoleName(value);
  return mapped === "Admin" ? 0 : mapped === "Teacher" ? 1 : 2;
};

const mapRoleName = (value) => {
  if (value === null || value === undefined || value === "") return "Student";
  if (Number.isInteger(value)) {
    return value === 0 ? "Admin" : value === 1 ? "Teacher" : "Student";
  }
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    return numeric === 0 ? "Admin" : numeric === 1 ? "Teacher" : "Student";
  }
  const normalized = raw.toLowerCase();
  if (normalized.includes("admin")) return "Admin";
  if (normalized.includes("teacher")) return "Teacher";
  if (normalized.includes("student")) return "Student";
  return "Student";
};

export default function UserManagement({ user, language = "Vietnamese" }) {
  const isVi = language === "Vietnamese";
  const isAdmin = normalizeRole(user?.role) === "admin";

  const [rows, setRows] = useState([{ ...defaultRow }]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [importInfo, setImportInfo] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [exportFileName, setExportFileName] = useState("users-export.xlsx");
  const [createdUsers, setCreatedUsers] = useState([]);

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
    importLabel: isVi ? "Tai file users.xlsx" : "Upload users.xlsx",
    importHint: isVi
      ? "File can co cot: email, userName, role (0=Admin,1=Teacher,2=Student)."
      : "File columns: email, userName, role (0=Admin,1=Teacher,2=Student).",
    clearList: isVi ? "Xoa danh sach" : "Clear list",
    importDone: isVi ? "Da tai" : "Loaded",
    exportTitle: isVi ? "Xuat danh sach" : "Export list",
    exportHint: isVi
      ? "Xuat Excel co mat khau ngau nhien cho tung user."
      : "Export Excel with random passwords per user.",
    exportPrompt: isVi ? "Nhap ten file xuat:" : "Enter export file name:",
    exportNameEmpty: isVi ? "Ten file khong hop le." : "Invalid file name.",
    exportBtn: isVi ? "Xuat Excel" : "Export Excel",
    exportEmpty: isVi ? "Danh sach trong, khong the xuat." : "List is empty, cannot export.",
    createdAccounts: isVi ? "Tài khoản đã tạo:" : "Created Accounts:",
    exportCreatedBtn: isVi ? "Xuất Excel Kết Quả" : "Export Results",
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

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setMessage({ type: "", text: "" });
    setImportInfo("");
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const importedRows = json
          .map((row) => ({
            email: String(row.email || "").trim(),
            userName: String(row.userName || row.username || "").trim(),
            roleName: mapRoleName(row.role ?? row.roleName),
          }))
          .filter((row) => row.email || row.userName || row.roleName);

        if (importedRows.length === 0) {
          setMessage({ type: "error", text: t.empty });
          setRows([{ ...defaultRow }]);
          return;
        }

        setRows(importedRows);
        setImportInfo(`${t.importDone} ${importedRows.length} user(s) tu ${file.name}.`);
      } catch (err) {
        setMessage({ type: "error", text: err.message || "Khong the doc file." });
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setIsParsing(false);
      setMessage({ type: "error", text: "Khong the doc file." });
    };

    reader.readAsArrayBuffer(file);
  };

  const handleClearList = () => {
    setRows([{ ...defaultRow }]);
    setFileName("");
    setImportInfo("");
    setMessage({ type: "", text: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!isAdmin) {
      setMessage({ type: "error", text: t.noPermission });
      return;
    }

    const payload = rows
      .map((row) => ({
        email: row.email.trim(),
        userName: row.userName.trim(),
        role: roleNameToCode(row.roleName)
      }))
      .filter((row) => row.email || row.userName || row.role !== undefined);

    if (payload.length === 0) {
      setMessage({ type: "error", text: t.empty });
      return;
    }

    const invalidRow = payload.find((row) => !row.email || !row.userName || row.role === undefined);
    if (invalidRow) {
      setMessage({ type: "error", text: t.empty });
      return;
    }

    setIsLoading(true);
    setCreatedUsers([]);
    try {
      const response = await createUsers(payload);
      setMessage({ type: "success", text: response?.message || t.success });
      setRows([{ ...defaultRow }]);
      if (response && response.data && response.data.length > 0) {
        setCreatedUsers(response.data);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || t.empty });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCreated = () => {
    if (createdUsers.length === 0) return;

    const inputName = window.prompt(t.exportPrompt, exportFileName) ?? "";
    const sanitized = inputName.trim();
    if (!sanitized) {
      setMessage({ type: "error", text: t.exportNameEmpty });
      return;
    }
    const file = sanitized.endsWith(".xlsx") ? sanitized : `${sanitized}.xlsx`;
    setExportFileName(file);

    const exportRows = createdUsers.map((row) => ({
      email: row.email,
      userName: row.userName,
      role: row.role,
      password: row.generatedPassword
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: ["email", "userName", "role", "password"]
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "users_created");
    XLSX.writeFile(workbook, file);
    setMessage({ type: "success", text: `${t.exportBtn}: ${file}` });
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

        <div className="user-import">
          <label className="user-import-label" htmlFor="user-import-file">{t.importLabel}</label>
          <div className="user-import-controls">
            <input
              id="user-import-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isParsing}
            />
            <button type="button" className="user-btn secondary" onClick={handleClearList}>
              {t.clearList}
            </button>
          </div>
          <p className="user-hint">{t.importHint}</p>
          {fileName && <div className="user-note">{importInfo || fileName}</div>}
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
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value}
                      </option>
                    ))}
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

        {createdUsers.length > 0 && (
          <div className="user-output" style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0 }}>{t.createdAccounts}</h4>
              <button type="button" className="user-btn" onClick={handleExportCreated}>
                {t.exportCreatedBtn}
              </button>
            </div>
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              <table className="demo-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Username</th>
                    <th>Password</th>
                  </tr>
                </thead>
                <tbody>
                  {createdUsers.map((u, i) => (
                    <tr key={i}>
                      <td>{u.email}</td>
                      <td>{u.userName}</td>
                      <td><code>{u.generatedPassword}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
