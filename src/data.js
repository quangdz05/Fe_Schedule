/**
 * Data model and constants for the Multi-Constraint Scheduling System
 * Hệ thống Lập lịch Đa Ràng Buộc
 */

import { RoomType, DeliveryMode } from "./constants/enums";

export const rooms = [
  {
    id: "room-401",
    name: "Phòng 401",
    capacity: 30,
    roomType: RoomType.Theory,
    deliveryMode: DeliveryMode.Offline,
    icon: "🏫",
  },
  {
    id: "room-501",
    name: "Phòng 501",
    capacity: 80,
    roomType: RoomType.Theory,
    deliveryMode: DeliveryMode.Offline,
    icon: "🏛",
  },
  {
    id: "lab-101",
    name: "Phòng Máy 101",
    capacity: 30,
    roomType: RoomType.Practice,
    deliveryMode: DeliveryMode.Offline,
    icon: "💻",
  },
  {
    id: "zoom-1",
    name: "Zoom Meeting 1",
    capacity: 1000,
    roomType: RoomType.Theory,
    deliveryMode: DeliveryMode.Online,
    icon: "🌐",
  },
];

export const timeSlots = [
  { id: "t2-sang", day: "Thứ 2", shift: "Sáng", time: "07:00-12:00" },
  { id: "t2-chieu", day: "Thứ 2", shift: "Chiều", time: "13:00-19:00" },
  { id: "t3-sang", day: "Thứ 3", shift: "Sáng", time: "07:00-12:00" },
  { id: "t3-chieu", day: "Thứ 3", shift: "Chiều", time: "13:00-19:00" },
  { id: "t4-sang", day: "Thứ 4", shift: "Sáng", time: "07:00-12:00" },
  { id: "t4-chieu", day: "Thứ 4", shift: "Chiều", time: "13:00-19:00" },
  { id: "t5-sang", day: "Thứ 5", shift: "Sáng", time: "07:00-12:00" },
  { id: "t5-chieu", day: "Thứ 5", shift: "Chiều", time: "13:00-19:00" },
  { id: "t6-sang", day: "Thứ 6", shift: "Sáng", time: "07:00-12:00" },
  { id: "t6-chieu", day: "Thứ 6", shift: "Chiều", time: "13:00-19:00" },
  { id: "t7-sang", day: "Thứ 7", shift: "Sáng", time: "07:00-12:00" },
  { id: "t7-chieu", day: "Thứ 7", shift: "Chiều", time: "13:00-19:00" },
];

export const courses = [
  {
    id: "course-1",
    name: "Toán rời rạc",
    lecturer: "Nguyễn Văn A",
    lecturerIcon: "👨‍🏫",
    classGroup: "Lớp K65-A",
    students: 28,
    requiredRoomType: RoomType.Theory,
    deliveryMode: DeliveryMode.Offline,
  },
  {
    id: "course-2",
    name: "Lập trình C++",
    lecturer: "Trần Thị B",
    lecturerIcon: "👩‍🏫",
    classGroup: "Lớp K65-B",
    students: 35,
    requiredRoomType: RoomType.Practice,
    deliveryMode: DeliveryMode.Offline,
  },
  {
    id: "course-3",
    name: "Triết học",
    lecturer: "Lê Văn C",
    lecturerIcon: "👨‍🏫",
    classGroup: "Lớp K65-C",
    students: 60,
    requiredRoomType: RoomType.Theory,
    deliveryMode: DeliveryMode.Offline,
  },
  {
    id: "course-4",
    name: "Cơ sở dữ liệu",
    lecturer: "Phạm Thị D",
    lecturerIcon: "👩‍🏫",
    classGroup: "Lớp K66-A",
    students: 25,
    requiredRoomType: RoomType.Practice,
    deliveryMode: DeliveryMode.Offline,
  },
  {
    id: "course-5",
    name: "Toán rời rạc",
    lecturer: "Nguyễn Văn A",
    lecturerIcon: "👨‍🏫",
    classGroup: "Lớp K65-B",
    students: 35,
    requiredRoomType: RoomType.Theory,
    deliveryMode: DeliveryMode.Offline,
  },
  {
    id: "course-6",
    name: "Lập trình C++",
    lecturer: "Trần Thị B",
    lecturerIcon: "👩‍🏫",
    classGroup: "Lớp K65-A",
    students: 28,
    requiredRoomType: RoomType.Practice,
    deliveryMode: DeliveryMode.Offline,
  },
];

