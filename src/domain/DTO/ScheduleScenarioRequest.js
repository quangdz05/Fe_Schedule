/**
 * DTOs cho API v2 — SortSchedule Backend
 * Swagger: POST /api/schedule/solve, POST /api/schedule/evaluate-move, POST /api/schedule/hover-lesson
 */

/** POST /api/schedule/solve — SolveScheduleRequest */
export class SolveRequest {
  constructor({ name = "New Schedule", courseSectionIds = [] } = {}) {
    this.name = name;
    this.courseSectionIds = courseSectionIds;
  }
}

/** POST /api/schedule/evaluate-move — EvaluateMoveRequest */
export class EvaluateMoveRequest {
  /**
   * @param {string} sessionId
   * @param {{ lessonId: number, newTimeSlotId: number|null, newRoomId: number|null }[]} moves
   */
  constructor({ sessionId, moves = [] } = {}) {
    this.sessionId = sessionId;
    this.moves = moves;
  }
}

/** POST /api/schedule/hover-lesson — LessonDetailRequest */
export class LessonDetailRequest {
  /**
   * @param {string} sessionId
   * @param {number} lessonId
   */
  constructor({ sessionId, lessonId } = {}) {
    this.sessionId = sessionId;
    this.lessonId = lessonId;
  }
}
