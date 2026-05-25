export default function Footer({ language = "English" }) {
  const isVi = language === "Vietnamese";

  return (
    <footer className="bottom-footer">
      <div>

        <p>{isVi ? "DÀNH CHO GIẢNG VIÊN VJU" : "FOR VJU LECTURERS"}</p>
        <p>phongdaotao@st.vju.ac.vn</p>
      </div>
      <div>
        <p>{isVi ? "PHẦN MỀM XẾP GIẢNG DẠY VÀ HỌC TẬP CHO GIẢNG VIÊN VÀ SINH VIÊN VJU" : "SCHEDULING SOFTWARE FOR VJU LECTURERS AND STUDENTS"}</p>
        <p>{isVi ? "Phòng Đào tạo và Công tác Sinh viên, email: phongdaotao@st.vju.ac.vn" : "Academic and Student Affair, email: phongdaotao@st.vju.ac.vn"}</p>
      </div>
      <div>
        <p>{isVi ? "PHẦN MỀM XẾP GIẢNG DẠY VÀ HỌC TẬP CHO GIẢNG VIÊN VÀ SINH VIÊN VJU" : "SCHEDULING SOFTWARE FOR VJU LECTURERS AND STUDENTS"}</p>
        <p>{isVi ? "Phòng Đào tạo và Công tác Sinh viên, email: phongdaotao@st.vju.ac.vn" : "Academic and Student Affair, email: phongdaotao@st.vju.ac.vn"}</p>
      </div>

    </footer>
  );
}
