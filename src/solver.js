/**
 * CSP (Constraint Satisfaction Problem) Solver
 * Backtracking algorithm with constraint checking for the scheduling system
 */

import { rooms, timeSlots } from "./data";

/**
 * Check all constraints for a single assignment
 * @param {string} courseId
 * @param {string} timeSlotId
 * @param {string} roomId
 * @param {Object} currentAssignments - Map of courseId -> {timeSlotId, roomId}
 * @param {Array} allCourses
 * @returns {{valid: boolean, violations: string[]}}
 */
export function checkConstraints(
  courseId,
  timeSlotId,
  roomId,
  currentAssignments,
  allCourses
) {
  const violations = [];
  const course = allCourses.find((c) => c.id === courseId);
  const room = rooms.find((r) => r.id === roomId);

  if (!course || !room) {
    return { valid: false, violations: ["Môn học hoặc phòng không tồn tại"] };
  }

  // Constraint 1: Room capacity
  if (course.students > room.capacity) {
    violations.push(
      `Sức chứa: ${course.name} (${course.students} SV) > ${room.name} (${room.capacity} chỗ)`
    );
  }

  // Constraint 2: Delivery Mode compatibility (Online/Offline)
  if (course.deliveryMode !== room.deliveryMode) {
    const cMode = course.deliveryMode === 0 ? "Offline" : "Online";
    const rMode = room.deliveryMode === 0 ? "Offline" : "Online";
    violations.push(
      `Hình thức: ${course.name} (${cMode}) ≠ ${room.name} (${rMode})`
    );
  }

  // Constraint 2.5: Room Type compatibility (Theory/Practice)
  if (course.requiredRoomType !== room.roomType) {
    const cType = course.requiredRoomType === 0 ? "Lý thuyết" : "Thực hành";
    const rType = room.roomType === 0 ? "Lý thuyết" : "Thực hành";
    violations.push(
      `Loại phòng: ${course.name} (${cType}) ≠ ${room.name} (${rType})`
    );
  }

  // Check against existing assignments
  for (const [existingCourseId, assignment] of Object.entries(
    currentAssignments
  )) {
    if (existingCourseId === courseId) continue;
    if (assignment.timeSlotId !== timeSlotId) continue;

    const existingCourse = allCourses.find((c) => c.id === existingCourseId);
    if (!existingCourse) continue;

    // Constraint 3: Same room, same time slot -> conflict
    if (assignment.roomId === roomId) {
      violations.push(
        `Trùng phòng: ${room.name} đã có "${existingCourse.name}" ở khung giờ này`
      );
    }

    // Constraint 4: Same lecturer, same time slot
    if (existingCourse.lecturer === course.lecturer) {
      violations.push(
        `Trùng GV: ${course.lecturer} đã dạy "${existingCourse.name}" ở khung giờ này`
      );
    }

    // Constraint 5: Same class group, same time slot
    if (existingCourse.classGroup === course.classGroup) {
      violations.push(
        `Trùng lớp: ${course.classGroup} đã học "${existingCourse.name}" ở khung giờ này`
      );
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Calculate the score for the current schedule
 * @param {Object} assignments - Map of courseId -> {timeSlotId, roomId}
 * @param {Array} allCourses
 * @returns {{score: number, details: string[]}}
 */
export function calculateScore(assignments, allCourses) {
  let score = 0;
  const details = [];
  let totalViolations = 0;

  for (const [courseId, assignment] of Object.entries(assignments)) {
    const result = checkConstraints(
      courseId,
      assignment.timeSlotId,
      assignment.roomId,
      assignments,
      allCourses
    );

    if (result.valid) {
      score += 10;
      const course = allCourses.find((c) => c.id === courseId);
      details.push(`✅ ${course?.name}: +10`);
    } else {
      totalViolations += result.violations.length;
      score -= 5 * result.violations.length;
      const course = allCourses.find((c) => c.id === courseId);
      details.push(
        `❌ ${course?.name}: -${5 * result.violations.length} (${result.violations.length} vi phạm)`
      );
    }
  }

  // Bonus for scheduling all courses
  if (
    Object.keys(assignments).length === allCourses.length &&
    totalViolations === 0
  ) {
    score += 20;
    
  }

  return { score, details };
}

/**
 * Get all violations in the current schedule
 * @param {Object} assignments
 * @param {Array} allCourses
 * @returns {Array<{courseId: string, violations: string[]}>}
 */
export function getAllViolations(assignments, allCourses) {
  const allViolations = [];

  for (const [courseId, assignment] of Object.entries(assignments)) {
    const result = checkConstraints(
      courseId,
      assignment.timeSlotId,
      assignment.roomId,
      assignments,
      allCourses
    );

    if (!result.valid) {
      allViolations.push({ courseId, violations: result.violations });
    }
  }

  return allViolations;
}

/**
 * Solve the scheduling problem using Backtracking CSP
 * @param {Array} allCourses
 * @returns {Object|null} - assignments map or null if no solution
 */
export function solveCSP(allCourses) {
  const assignments = {};

  function backtrack(courseIndex) {
    // Base case: all courses assigned
    if (courseIndex === allCourses.length) {
      return true;
    }

    const course = allCourses[courseIndex];

    // Try each combination of timeSlot and room
    for (const timeSlot of timeSlots) {
      for (const room of rooms) {
        const result = checkConstraints(
          course.id,
          timeSlot.id,
          room.id,
          assignments,
          allCourses
        );

        if (result.valid) {
          // Assign
          assignments[course.id] = {
            timeSlotId: timeSlot.id,
            roomId: room.id,
          };

          // Recurse
          if (backtrack(courseIndex + 1)) {
            return true;
          }

          // Backtrack
          delete assignments[course.id];
        }
      }
    }

    return false;
  }

  const solved = backtrack(0);
  return solved ? { ...assignments } : null;
}
