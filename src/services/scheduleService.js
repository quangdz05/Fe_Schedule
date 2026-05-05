import { authHeaders } from "./authService";
import { ScheduleScenarioRequest, ScheduleData } from "../domain/DTO/ScheduleScenarioRequest";
import { BASE_URL } from "../data/api/api_config";

/**
 * Chuyển đổi dữ liệu từ UI sang định dạng API
 */
export function transformToApiFormat(scenarioId, rooms, timeSlots, courses) {
  // Tạo danh sách giảng viên duy nhất
  const teachers = Array.from(new Set(courses.map(c => c.lecturer))).map((name, index) => ({
    id: index + 1,
    name: name,
    specificRequirements: null
  }));

  // Tạo danh sách nhóm sinh viên duy nhất
  const studentGroups = Array.from(new Set(courses.map(c => c.classGroup))).map((name, index) => ({
    id: index + 1,
    name: name,
    size: courses.find(c => c.classGroup === name).students
  }));

  // Tạo danh sách môn học duy nhất
  const subjects = Array.from(new Set(courses.map(c => c.name))).map((name, index) => ({
    id: index + 1,
    name: name,
    requiredRoomType: courses.find(c => c.name === name).requiredRoomType
  }));

  // Map phòng
  const roomMap = {};
  const reverseRoomMap = {};
  const apiRooms = rooms.map((r, index) => {
    const apiId = index + 1;
    roomMap[r.id] = apiId;
    reverseRoomMap[apiId] = r.id;
    return {
      id: apiId,
      name: r.name,
      capacity: r.capacity,
      roomType: r.roomType
    };
  });

  // Map khung giờ
  const slotMap = {};
  const reverseSlotMap = {};
  const apiTimeSlots = timeSlots.map((ts, index) => {
    const apiId = index + 1;
    slotMap[ts.id] = apiId;
    reverseSlotMap[apiId] = ts.id;
    const dayMap = { "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6, "Chủ Nhật": 0 };
    const [start, end] = ts.time.split("-");
    return {
      id: apiId,
      dayOfWeek: dayMap[ts.day] || 1,
      startTime: `${start.trim()}:00`,
      endTime: `${end.trim()}:00`
    };
  });

  // Map bài học
  const lessonCourseMap = {};
  const apiLessons = courses.map((c, index) => {
    const apiId = index + 1;
    lessonCourseMap[apiId] = c.id;
    const teacherId = teachers.find(t => t.name === c.lecturer).id;
    const studentGroupId = studentGroups.find(sg => sg.name === c.classGroup).id;
    const subjectId = subjects.find(s => s.name === c.name).id;
    return {
      id: apiId,
      teacherId,
      studentGroupId,
      subjectId,
      requiredRoomType: c.requiredRoomType,
      deliveryMode: c.deliveryMode,
      roomId: null,
      timeSlotId: null
    };
  });

  const scheduleData = new ScheduleData({
    teachers,
    rooms: apiRooms,
    studentGroups,
    subjects,
    timeSlots: apiTimeSlots,
    lessons: apiLessons
  });

  const request = new ScheduleScenarioRequest({
    scenarioId,
    saveScenario: true,
    saveResult: true,
    schedule: scheduleData
  });

  return { request, reverseRoomMap, reverseSlotMap, lessonCourseMap };
}

/**
 * Lưu kịch bản lập lịch
 */
export async function saveScenario(scenarioId, schedule) {
  if (!scenarioId) {
    throw new Error("Thiếu scenarioId để lưu kịch bản.");
  }

  const res = await fetch(`${BASE_URL}/api/schedule/scenarios/${scenarioId}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "accept": "*/*"
    },
    body: JSON.stringify(schedule),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Lưu kịch bản thất bại (${res.status}): ${errorText}`);
  }

  return await res.json().catch(() => ({ success: true }));
}

/**
 * Giải bài toán lập lịch
 */
export async function solveSchedule(scenarioRequest) {
  const res = await fetch(`${BASE_URL}/api/schedule/solve`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "accept": "application/json"
    },
    body: JSON.stringify(scenarioRequest),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Giải bài toán lập lịch thất bại (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Lấy kết quả lập lịch theo scenarioId
 */
export async function getScheduleResult(scenarioId) {
  if (!scenarioId) {
    throw new Error("Thiếu scenarioId để lấy kết quả.");
  }

  const res = await fetch(`${BASE_URL}/api/schedule/result/${scenarioId}`, {
    method: "GET",
    headers: {
      ...authHeaders(),
      "accept": "application/json"
    }
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Lấy kết quả thất bại (${res.status}): ${errorText}`);
  }

  return await res.json();
}
