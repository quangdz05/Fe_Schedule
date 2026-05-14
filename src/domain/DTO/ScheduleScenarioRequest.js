/** POST /api/schedule/solve
 * @see SolveScheduleRequest in swagger.json
 */
export class SolveRequest {
  constructor({ name = "New Schedule", courseSectionIds = [] } = {}) {
    this.name = name;
    this.courseSectionIds = courseSectionIds;
  }
}

/** POST /api/schedule/evaluate-move
 * @see EvaluateMoveRequest in swagger.json
 */
export class EvaluateMoveRequest {
  constructor({ sessionId, moves = [] } = {}) {
    this.sessionId = sessionId;
    this.moves = moves; // [{ lessonId, newTimeSlotId, newRoomId }]
  }
}

/** POST /api/schedule/hover-lesson
 * @see LessonDetailRequest in swagger.json
 */
export class LessonDetailRequest {
  constructor({ sessionId, lessonId } = {}) {
    this.sessionId = sessionId;
    this.lessonId = lessonId;
  }
}
