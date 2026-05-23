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
  RoomNotAssigned: 7,
  AutoPlaceFailed: 8,
  TeacherDoubleBooking: 9,
  StudentDoubleBooking: 10,
  RoomDoubleBooking: 11,
  RoomCapacityViolation: 12,
  RoomTypeViolation: 13,
  TeacherAvailabilityViolation: 14,
  TeacherMaxSlotsViolation: 15,
  LateSlotPenalty: 16,
  SaturdayPenalty: 17,
  TeacherConstraintViolation: 18,
  TeacherSessionCompactness: 19,
  StudentIdleGap: 20,
  MultiSessionGap: 21
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
  0: "[!] Nghiêm trọng",
  1: "[i] Gợi ý",
  2: "[!] Cảnh báo"
};
export const ConflictTypeLabelMap = {
  0: "GV thỉnh giảng không có slot trống",
  1: "Môn bắt buộc chưa được xếp",
  2: "Xung đột môn tự chọn",
  3: "Nhóm sinh viên quá tải",
  4: "Vi phạm múi giờ",
  5: "Môn bắt buộc bị trùng chéo",
  6: "Vi phạm nghỉ trưa",
  7: "Chưa gán phòng học",
  8: "Lỗi xếp tự động",
  9: "Giảng viên bị trùng lịch",
  10: "Sinh viên bị trùng lịch",
  11: "Trùng lịch phòng học",
  12: "Phòng học không đủ chỗ",
  13: "Sai loại phòng yêu cầu",
  15: "GV vượt quá số tiết tối đa",
  16: "Học ca tối muộn",
  17: "Học cuối tuần (Thứ 7)",
  18: "Vi phạm giờ GV không ưu tiên",
  19: "GV dạy cả sáng & chiều",
  20: "SV bị trống tiết quá lâu",
  21: "Khoảng cách giữa các buổi quá ngắn"
};
