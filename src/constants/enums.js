/**
 * Enums mapping from Backend (C#)
 */
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
