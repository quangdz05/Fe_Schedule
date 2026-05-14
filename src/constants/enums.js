/**
 * Enums mapping from Backend (C#) — v2 API
 */

// === Enums hiện có (giữ nguyên) ===
export const RoomType = {
  Theory: 0,
  Practice: 1
};

export const DeliveryMode = {
  Offline: 0,
  Online: 1
};

// === Enums MỚI (v2) ===
export const TeacherType = { Resident: 0, Guest: 1 };
export const CourseType = { Required: 0, Elective: 1 };
export const TeacherRole = { Primary: 0, Assistant: 1 };

export const SolveStatus = {
  Queued: "Queued",
  Running: "Running",
  Completed: "Completed",
  Failed: "Failed"
};

export const ConflictLevel = { Hard: 0, Soft: 1, Warning: 2 };
export const ConflictType = {
  GuestNoSlot: 0,
  RequiredNotPlaced: 1,
  ElectiveConflict: 2,
  StudentGroupOverload: 3,
  TimezoneViolation: 4,
  RequiredSingleSectionOverlap: 5,
  LunchBreakViolation: 6,
  RoomNotAssigned: 7
};

// === Labels cho UI ===
export const RoomTypeLabels = {
  [RoomType.Theory]: "Lý thuyết",
  [RoomType.Practice]: "Thực hành"
};

export const DeliveryModeLabels = {
  [DeliveryMode.Offline]: "Trực tiếp",
  [DeliveryMode.Online]: "Trực tuyến"
};

export const TeacherTypeLabels = { 0: "Cơ hữu", 1: "Thỉnh giảng" };
export const CourseTypeLabels  = { 0: "Bắt buộc", 1: "Tự chọn" };
export const ConflictLevelLabels = {
  0: "[!] Nghiem trong",
  1: "[i] Goi y",
  2: "[!] Canh bao"
};
export const ConflictTypeLabelMap = {
  0: "GV thỉnh giảng không có slot trống",
  1: "Môn bắt buộc chưa được xếp",
  2: "Xung đột môn tự chọn",
  3: "Nhóm SV quá tải",
  4: "Vi phạm múi giờ",
  5: "Môn bắt buộc có section bị chồng chéo",
  6: "Vi phạm nghỉ trưa",
  7: "Phòng chưa được phân công"
};
