class ScheduleScenarioRequest {
  constructor({
    scenarioId = "",
    saveScenario = true,
    saveResult = true,
    schedule = null
  } = {}) {
    this.scenarioId = scenarioId;
    this.saveScenario = saveScenario;
    this.saveResult = saveResult;
    this.schedule = schedule ? new ScheduleData(schedule) : null;
  }
}

class ScheduleData {
  constructor({
    teachers = [],
    rooms = [],
    studentGroups = [],
    subjects = [],
    timeSlots = [],
    lessons = []
  } = {}) {
    this.teachers = teachers;
    this.rooms = rooms;
    this.studentGroups = studentGroups;
    this.subjects = subjects;
    this.timeSlots = timeSlots;
    this.lessons = lessons;
  }
}

export { ScheduleScenarioRequest, ScheduleData };
