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

// Map names for UI display
export const RoomTypeLabels = {
  [RoomType.Theory]: "Lý thuyết",
  [RoomType.Practice]: "Thực hành"
};

export const DeliveryModeLabels = {
  [DeliveryMode.Offline]: "Trực tiếp",
  [DeliveryMode.Online]: "Trực tuyến"
};

// === Enums MỚI (v2 API) ===
export const TeacherType = { Resident: 0, Guest: 1 };
export const CourseType  = { Required: 0, Elective: 1 };

export const SolveStatus = {
  Queued:    "Queued",
  Running:   "Running",
  Completed: "Completed",
  Failed:    "Failed"
};

export const ConflictLevel = { Hard: 0, Soft: 1, Warning: 2 };

export const ConflictType = {
  GuestNoSlot:                   0,
  RequiredNotPlaced:             1,
  ElectiveConflict:              2,
  StudentGroupOverload:          3,
  TimezoneViolation:             4,
  RequiredSingleSectionOverlap:  5,
  LunchBreakViolation:           6,
  RoomNotAssigned:               7
};

// Labels cho UI
export const TeacherTypeLabels = {
  [TeacherType.Resident]: "Cơ hữu",
  [TeacherType.Guest]:    "Thỉnh giảng"
};

export const CourseTypeLabels = {
  [CourseType.Required]: "Bắt buộc",
  [CourseType.Elective]: "Tự chọn"
};

export const ConflictLevelLabels = {
  [ConflictLevel.Hard]:    "⛔ Nghiêm trọng",
  [ConflictLevel.Soft]:    "ℹ️ Gợi ý",
  [ConflictLevel.Warning]: "⚠️ Cảnh báo"
};

export const ConflictLevelKeys = {
  [ConflictLevel.Hard]:    "hard",
  [ConflictLevel.Soft]:    "soft",
  [ConflictLevel.Warning]: "warning"
};
