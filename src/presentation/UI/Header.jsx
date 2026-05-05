import logoImage from "../../../assets/images/logo.png";

export default function Header({ language = "English" }) {
  const isVi = language === "Vietnamese";

  return (
    <header className="top-header">
      <div className="brand-wrap">
        <img className="logo-image" src={logoImage} alt="Vietnam Japan University logo" />
        <div className="title-group">
          <p>TRƯỜNG ĐẠI HỌC VIỆT NHẬT</p>
          <p>VNU VIETNAM JAPAN UNIVERSITY</p>
          <h1>{isVi ? "PHẦN MỀM XẾP LỊCH HỌC" : "EXAM SCHEDULING SOFTWARE"}</h1>
        </div>
      </div>
    </header>
  );
}
