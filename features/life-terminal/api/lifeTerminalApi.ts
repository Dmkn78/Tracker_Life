import {
  expectJsonObject,
  expectNumber,
  expectString
} from "@/lib/http/apiClient";
import {
  LIFE_REGIMES,
  type JsonValue,
  type LifeRegime,
  type LifeTerminalAllocationRow,
  type LifeTerminalData,
  type LifeTerminalEvent,
  type LifeTerminalTask,
  type LifeTerminalTrajectoryPoint
} from "../domain/lifeTerminal";

type TerminalHeader = LifeTerminalData["terminalHeader"];
type LifeTape = LifeTerminalData["lifeTape"];
type RegimeDetection = LifeTerminalData["regime"];
type QuantProjection = LifeTerminalData["quant"];
type CalendarContext = LifeTerminalData["calendarContext"];
type TaskMetrics = LifeTerminalData["taskMetrics"];
type TimeAllocation = LifeTerminalData["timeAllocation"];
type QuickLog = LifeTerminalData["quickLog"];
type WeeklyPlanner = LifeTerminalData["weeklyPlanner"];
type DataQuality = LifeTerminalData["dataQuality"];

export function parseLifeTerminalData(payload: unknown): LifeTerminalData {
  const response = expectJsonObject(payload, "life terminal response");
  return {
    today: expectString(response.today, "life terminal response.today"),
    weekId: expectString(response.weekId, "life terminal response.weekId"),
    terminalHeader: parseTerminalHeader(response.terminalHeader),
    lifeTape: parseLifeTape(response.lifeTape),
    regime: parseRegimeDetection(response.regime),
    quant: parseQuantProjection(response.quant),
    calendarContext: parseCalendarContext(response.calendarContext),
    trajectory: parseArray(
      response.trajectory,
      "life terminal response.trajectory",
      parseTrajectoryPoint
    ),
    enoughForTrend: expectBoolean(
      response.enoughForTrend,
      "life terminal response.enoughForTrend"
    ),
    initialEvents: parseArray(
      response.initialEvents,
      "life terminal response.initialEvents",
      parseCalendarEvent
    ),
    taskSections: parseTaskSections(response.taskSections),
    taskMetrics: parseTaskMetrics(response.taskMetrics),
    timeAllocation: parseTimeAllocation(response.timeAllocation),
    quickLog: parseQuickLog(response.quickLog),
    weeklyPlanner: parseWeeklyPlanner(response.weeklyPlanner),
    dataQuality: parseDataQuality(response.dataQuality),
    weeklySummary: parseWeeklySummary(response.weeklySummary),
    interpretation: parseStringArray(
      response.interpretation,
      "life terminal response.interpretation"
    )
  };
}

function parseWeeklySummary(
  payload: unknown
): LifeTerminalData["weeklySummary"] {
  const summary = expectJsonObject(payload, "life terminal response.weeklySummary");
  const period = expectJsonObject(summary.period, "life terminal response.weeklySummary.period");
  return {
    weekId: expectString(summary.weekId, "life terminal response.weeklySummary.weekId"),
    period: {
      start: expectString(period.start, "life terminal response.weeklySummary.period.start"),
      end: expectString(period.end, "life terminal response.weeklySummary.period.end")
    },
    avgStateScore: expectNullableNumber(
      summary.avgStateScore,
      "life terminal response.weeklySummary.avgStateScore"
    ),
    avgRiskScore: expectNullableNumber(
      summary.avgRiskScore,
      "life terminal response.weeklySummary.avgRiskScore"
    ),
    avgExecutionScore: expectNullableNumber(
      summary.avgExecutionScore,
      "life terminal response.weeklySummary.avgExecutionScore"
    ),
    avgStartFriction: expectNullableNumber(
      summary.avgStartFriction,
      "life terminal response.weeklySummary.avgStartFriction"
    ),
    submittedLogs: expectNumber(
      summary.submittedLogs,
      "life terminal response.weeklySummary.submittedLogs"
    ),
    missingDays: expectNumber(
      summary.missingDays,
      "life terminal response.weeklySummary.missingDays"
    ),
    missingDayKeys: parseStringArray(
      summary.missingDayKeys,
      "life terminal response.weeklySummary.missingDayKeys"
    ),
    skippedDays: expectNumber(
      summary.skippedDays,
      "life terminal response.weeklySummary.skippedDays"
    ),
    skippedDayKeys: parseStringArray(
      summary.skippedDayKeys,
      "life terminal response.weeklySummary.skippedDayKeys"
    ),
    trainingDays: expectNumber(
      summary.trainingDays,
      "life terminal response.weeklySummary.trainingDays"
    ),
    activePhase: expectString(
      summary.activePhase,
      "life terminal response.weeklySummary.activePhase"
    )
  };
}

function parseTerminalHeader(payload: unknown): TerminalHeader {
  const header = expectJsonObject(payload, "life terminal response.terminalHeader");
  return {
    date: expectString(header.date, "life terminal response.terminalHeader.date"),
    weekId: expectString(header.weekId, "life terminal response.terminalHeader.weekId"),
    regime: expectLifeRegime(header.regime, "life terminal response.terminalHeader.regime"),
    phase: expectString(header.phase, "life terminal response.terminalHeader.phase"),
    dailyLogStatus: expectString(
      header.dailyLogStatus,
      "life terminal response.terminalHeader.dailyLogStatus"
    ),
    nextHighImpactEvent: parseNullableCalendarEvent(
      header.nextHighImpactEvent,
      "life terminal response.terminalHeader.nextHighImpactEvent"
    ),
    dataQuality: expectString(
      header.dataQuality,
      "life terminal response.terminalHeader.dataQuality"
    ),
    risk: expectString(header.risk, "life terminal response.terminalHeader.risk")
  };
}

function parseLifeTape(payload: unknown): LifeTape {
  const tape = expectJsonObject(payload, "life terminal response.lifeTape");
  return {
    items: parseArray(tape.items, "life terminal response.lifeTape.items", (item, context) => {
      const record = expectJsonObject(item, context);
      return {
        label: expectString(record.label, `${context}.label`),
        value: expectNullableNumber(record.value, `${context}.value`),
        delta: expectNumber(record.delta, `${context}.delta`),
        inverted: expectBoolean(record.inverted, `${context}.inverted`)
      };
    }),
    calendarPressureLabel: expectString(
      tape.calendarPressureLabel,
      "life terminal response.lifeTape.calendarPressureLabel"
    )
  };
}

function parseRegimeDetection(payload: unknown): RegimeDetection {
  const regime = expectJsonObject(payload, "life terminal response.regime");
  return {
    regime: expectLifeRegime(regime.regime, "life terminal response.regime.regime"),
    confidence: expectNumber(regime.confidence, "life terminal response.regime.confidence"),
    why: parseStringArray(regime.why, "life terminal response.regime.why"),
    lastRegime: expectNullableLifeRegime(
      regime.lastRegime,
      "life terminal response.regime.lastRegime"
    ),
    changed: expectBoolean(regime.changed, "life terminal response.regime.changed")
  };
}

function parseQuantProjection(payload: unknown): QuantProjection {
  const quant = expectJsonObject(payload, "life terminal response.quant");
  return {
    projection: parseArray(
      quant.projection,
      "life terminal response.quant.projection",
      (item, context) => {
        const projection = expectJsonObject(item, context);
        return {
          regime: expectLifeRegime(projection.regime, `${context}.regime`),
          probability: expectNumber(projection.probability, `${context}.probability`)
        };
      }
    ),
    transitionMatrix: parseArray(
      quant.transitionMatrix,
      "life terminal response.quant.transitionMatrix",
      (item, context) => {
        const row = expectJsonObject(item, context);
        const probabilities = expectJsonObject(row.probabilities, `${context}.probabilities`);
        return {
          from: expectLifeRegime(row.from, `${context}.from`),
          active: expectBoolean(row.active, `${context}.active`),
          probabilities: {
            stable: expectNumber(probabilities.stable, `${context}.probabilities.stable`),
            productive: expectNumber(
              probabilities.productive,
              `${context}.probabilities.productive`
            ),
            pressure: expectNumber(probabilities.pressure, `${context}.probabilities.pressure`),
            recovery: expectNumber(probabilities.recovery, `${context}.probabilities.recovery`),
            drift: expectNumber(probabilities.drift, `${context}.probabilities.drift`),
            burnout_risk: expectNumber(
              probabilities.burnout_risk,
              `${context}.probabilities.burnout_risk`
            ),
            chaotic: expectNumber(probabilities.chaotic, `${context}.probabilities.chaotic`)
          }
        };
      }
    )
  };
}

function parseCalendarContext(payload: unknown): CalendarContext {
  const context = expectJsonObject(payload, "life terminal response.calendarContext");
  return {
    activePhase: expectString(
      context.activePhase,
      "life terminal response.calendarContext.activePhase"
    ),
    highImpactEventsNext7d: expectNumber(
      context.highImpactEventsNext7d,
      "life terminal response.calendarContext.highImpactEventsNext7d"
    ),
    maxImpact: expectNullableString(
      context.maxImpact,
      "life terminal response.calendarContext.maxImpact"
    ),
    averageStress: expectNumber(
      context.averageStress,
      "life terminal response.calendarContext.averageStress"
    ),
    averagePreparationLoad: expectNumber(
      context.averagePreparationLoad,
      "life terminal response.calendarContext.averagePreparationLoad"
    ),
    weeklyExpectedStressLoad: expectNumber(
      context.weeklyExpectedStressLoad,
      "life terminal response.calendarContext.weeklyExpectedStressLoad"
    ),
    weeklyExpectedPreparationLoad: expectNumber(
      context.weeklyExpectedPreparationLoad,
      "life terminal response.calendarContext.weeklyExpectedPreparationLoad"
    ),
    nextHighImpactEvent: parseNullableCalendarEvent(
      context.nextHighImpactEvent,
      "life terminal response.calendarContext.nextHighImpactEvent"
    ),
    pressureLevel: expectNumber(
      context.pressureLevel,
      "life terminal response.calendarContext.pressureLevel"
    )
  };
}

function parseTrajectoryPoint(
  payload: unknown,
  context: string
): LifeTerminalTrajectoryPoint {
  const point = expectJsonObject(payload, context);
  return {
    date: expectString(point.date, `${context}.date`),
    status: expectString(point.status, `${context}.status`),
    stateScore: expectNullableNumber(point.stateScore, `${context}.stateScore`),
    riskScore: expectNullableNumber(point.riskScore, `${context}.riskScore`),
    executionScore: expectNullableNumber(point.executionScore, `${context}.executionScore`),
    startFriction: expectNullableNumber(point.startFriction, `${context}.startFriction`),
    productivity: expectNullableNumber(point.productivity, `${context}.productivity`),
    energy: expectNullableNumber(point.energy, `${context}.energy`),
    caloriePercent: expectNullableNumber(point.caloriePercent, `${context}.caloriePercent`),
    calendarPressure: expectNumber(point.calendarPressure, `${context}.calendarPressure`),
    todoCompletion: expectNumber(point.todoCompletion, `${context}.todoCompletion`)
  };
}

function parseTaskSections(payload: unknown): LifeTerminalData["taskSections"] {
  const sections = expectJsonObject(payload, "life terminal response.taskSections");
  return {
    today: parseTaskArray(sections.today, "life terminal response.taskSections.today"),
    thisWeek: parseTaskArray(sections.thisWeek, "life terminal response.taskSections.thisWeek"),
    overdue: parseTaskArray(sections.overdue, "life terminal response.taskSections.overdue"),
    highImportance: parseTaskArray(
      sections.highImportance,
      "life terminal response.taskSections.highImportance"
    ),
    productive: parseTaskArray(
      sections.productive,
      "life terminal response.taskSections.productive"
    )
  };
}

function parseTaskMetrics(payload: unknown): TaskMetrics {
  const metrics = expectJsonObject(payload, "life terminal response.taskMetrics");
  const plannedVsDone = expectJsonObject(
    metrics.plannedVsDone,
    "life terminal response.taskMetrics.plannedVsDone"
  );
  return {
    today: parseTodoMetrics(metrics.today, "life terminal response.taskMetrics.today"),
    week: parseTodoMetrics(metrics.week, "life terminal response.taskMetrics.week"),
    plannedVsDone: {
      planned: expectNumber(
        plannedVsDone.planned,
        "life terminal response.taskMetrics.plannedVsDone.planned"
      ),
      done: expectNumber(
        plannedVsDone.done,
        "life terminal response.taskMetrics.plannedVsDone.done"
      )
    }
  };
}

function parseTimeAllocation(payload: unknown): TimeAllocation {
  const allocation = expectJsonObject(payload, "life terminal response.timeAllocation");
  return {
    dayBudgetMinutes: expectNumber(
      allocation.dayBudgetMinutes,
      "life terminal response.timeAllocation.dayBudgetMinutes"
    ),
    targetWeightTotal: expectNumber(
      allocation.targetWeightTotal,
      "life terminal response.timeAllocation.targetWeightTotal"
    ),
    actualMinutesTotal: expectNumber(
      allocation.actualMinutesTotal,
      "life terminal response.timeAllocation.actualMinutesTotal"
    ),
    plannedMinutesTotal: expectNumber(
      allocation.plannedMinutesTotal,
      "life terminal response.timeAllocation.plannedMinutesTotal"
    ),
    rows: parseArray(
      allocation.rows,
      "life terminal response.timeAllocation.rows",
      parseAllocationRow
    )
  };
}

function parseQuickLog(payload: unknown): QuickLog {
  const log = expectJsonObject(payload, "life terminal response.quickLog");
  return {
    date: expectString(log.date, "life terminal response.quickLog.date"),
    status: expectString(log.status, "life terminal response.quickLog.status"),
    energy: expectNumber(log.energy, "life terminal response.quickLog.energy"),
    productivity: expectNumber(log.productivity, "life terminal response.quickLog.productivity"),
    startFriction: expectNumber(log.startFriction, "life terminal response.quickLog.startFriction"),
    calorieTarget: expectNumber(log.calorieTarget, "life terminal response.quickLog.calorieTarget"),
    caloriePercent: expectNumber(log.caloriePercent, "life terminal response.quickLog.caloriePercent"),
    trainingDone: expectNullableBoolean(
      log.trainingDone,
      "life terminal response.quickLog.trainingDone"
    ),
    mentalFatigue: expectNumber(
      log.mentalFatigue,
      "life terminal response.quickLog.mentalFatigue"
    ),
    physicalFatigue: expectNumber(
      log.physicalFatigue,
      "life terminal response.quickLog.physicalFatigue"
    ),
    focusQuality: expectNumber(log.focusQuality, "life terminal response.quickLog.focusQuality"),
    workTimeMinutes: expectNumber(
      log.workTimeMinutes,
      "life terminal response.quickLog.workTimeMinutes"
    ),
    distractionTimeMinutes: expectNumber(
      log.distractionTimeMinutes,
      "life terminal response.quickLog.distractionTimeMinutes"
    ),
    avoidedImportantTask: expectNullableBoolean(
      log.avoidedImportantTask,
      "life terminal response.quickLog.avoidedImportantTask"
    ),
    mainBlocker: expectString(log.mainBlocker, "life terminal response.quickLog.mainBlocker"),
    improvementTomorrow: expectString(
      log.improvementTomorrow,
      "life terminal response.quickLog.improvementTomorrow"
    ),
    sleepIntentClickedAt: expectNullableString(
      log.sleepIntentClickedAt,
      "life terminal response.quickLog.sleepIntentClickedAt"
    ),
    estimatedSleepDelayMin: expectNumber(
      log.estimatedSleepDelayMin,
      "life terminal response.quickLog.estimatedSleepDelayMin"
    ),
    textSummary: expectString(log.textSummary, "life terminal response.quickLog.textSummary"),
    voiceTranscript: expectString(
      log.voiceTranscript,
      "life terminal response.quickLog.voiceTranscript"
    )
  };
}

function parseWeeklyPlanner(payload: unknown): WeeklyPlanner {
  const planner = expectJsonObject(payload, "life terminal response.weeklyPlanner");
  return {
    objective: expectString(planner.objective, "life terminal response.weeklyPlanner.objective"),
    topPriorities: parseTaskArray(
      planner.topPriorities,
      "life terminal response.weeklyPlanner.topPriorities"
    ),
    tasksByDay: parseArray(
      planner.tasksByDay,
      "life terminal response.weeklyPlanner.tasksByDay",
      (item, context) => {
        const day = expectJsonObject(item, context);
        return {
          date: expectString(day.date, `${context}.date`),
          tasks: parseTaskArray(day.tasks, `${context}.tasks`)
        };
      }
    ),
    majorEvents: parseArray(
      planner.majorEvents,
      "life terminal response.weeklyPlanner.majorEvents",
      parseCalendarEvent
    ),
    missingPlanningWarning: expectBoolean(
      planner.missingPlanningWarning,
      "life terminal response.weeklyPlanner.missingPlanningWarning"
    )
  };
}

function parseDataQuality(payload: unknown): DataQuality {
  const quality = expectJsonObject(payload, "life terminal response.dataQuality");
  return {
    submittedLogsThisWeek: expectNumber(
      quality.submittedLogsThisWeek,
      "life terminal response.dataQuality.submittedLogsThisWeek"
    ),
    missingDays: expectNumber(
      quality.missingDays,
      "life terminal response.dataQuality.missingDays"
    ),
    missingDayKeys: parseStringArray(
      quality.missingDayKeys,
      "life terminal response.dataQuality.missingDayKeys"
    ),
    calendarEvents: expectNumber(
      quality.calendarEvents,
      "life terminal response.dataQuality.calendarEvents"
    ),
    tasksTracked: expectNumber(
      quality.tasksTracked,
      "life terminal response.dataQuality.tasksTracked"
    ),
    enoughDataForTrend: expectBoolean(
      quality.enoughDataForTrend,
      "life terminal response.dataQuality.enoughDataForTrend"
    ),
    enoughDataForRegimeDetection: expectBoolean(
      quality.enoughDataForRegimeDetection,
      "life terminal response.dataQuality.enoughDataForRegimeDetection"
    ),
    weeklyExportPreview: parseJsonValue(
      quality.weeklyExportPreview,
      "life terminal response.dataQuality.weeklyExportPreview"
    )
  };
}

function parseCalendarEvent(payload: unknown, context: string): LifeTerminalEvent {
  const event = expectJsonObject(payload, context);
  return {
    id: expectString(event.id, `${context}.id`),
    title: expectString(event.title, `${context}.title`),
    type: expectString(event.type, `${context}.type`),
    start: expectString(event.start, `${context}.start`),
    end: expectString(event.end, `${context}.end`),
    impact: expectString(event.impact, `${context}.impact`),
    expectedStress: expectNumber(event.expectedStress, `${context}.expectedStress`),
    expectedPreparationLoad: expectNumber(
      event.expectedPreparationLoad,
      `${context}.expectedPreparationLoad`
    )
  };
}

function parseNullableCalendarEvent(
  payload: unknown,
  context: string
): LifeTerminalEvent | null {
  if (payload === null) return null;
  return parseCalendarEvent(payload, context);
}

function parseTaskArray(payload: unknown, context: string): LifeTerminalTask[] {
  return parseArray(payload, context, parseTask);
}

function parseTask(payload: unknown, context: string): LifeTerminalTask {
  const task = expectJsonObject(payload, context);
  return {
    id: expectString(task.id, `${context}.id`),
    title: expectString(task.title, `${context}.title`),
    date: expectString(task.date, `${context}.date`),
    importance: expectString(task.importance, `${context}.importance`),
    productive: expectBoolean(task.productive, `${context}.productive`),
    estimatedMinutes: expectNumber(task.estimatedMinutes, `${context}.estimatedMinutes`),
    completionPercent: expectNumber(task.completionPercent, `${context}.completionPercent`),
    status: expectString(task.status, `${context}.status`),
    createdAt: expectString(task.createdAt, `${context}.createdAt`),
    updatedAt: expectString(task.updatedAt, `${context}.updatedAt`)
  };
}

function parseTodoMetrics(payload: unknown, context: string): TaskMetrics["week"] {
  const metrics = expectJsonObject(payload, context);
  return {
    tasksPlanned: expectNumber(metrics.tasksPlanned, `${context}.tasksPlanned`),
    weightedCompletionRate: expectNumber(
      metrics.weightedCompletionRate,
      `${context}.weightedCompletionRate`
    ),
    missedImportantTasks: expectNumber(
      metrics.missedImportantTasks,
      `${context}.missedImportantTasks`
    ),
    productiveTaskCompletion: expectNumber(
      metrics.productiveTaskCompletion,
      `${context}.productiveTaskCompletion`
    )
  };
}

function parseAllocationRow(payload: unknown, context: string): LifeTerminalAllocationRow {
  const row = expectJsonObject(payload, context);
  return {
    id: expectString(row.id, `${context}.id`),
    name: expectString(row.name, `${context}.name`),
    objective: expectString(row.objective, `${context}.objective`),
    targetWeight: expectNumber(row.targetWeight, `${context}.targetWeight`),
    actualWeight: expectNumber(row.actualWeight, `${context}.actualWeight`),
    plannedMinutes: expectNumber(row.plannedMinutes, `${context}.plannedMinutes`),
    autoPlannedMinutes: expectNumber(row.autoPlannedMinutes, `${context}.autoPlannedMinutes`),
    plannedMinutesManual: expectBoolean(
      row.plannedMinutesManual,
      `${context}.plannedMinutesManual`
    ),
    actualMinutes: expectNumber(row.actualMinutes, `${context}.actualMinutes`),
    color: expectString(row.color, `${context}.color`)
  };
}

function parseStringArray(payload: unknown, context: string): string[] {
  return parseArray(payload, context, (value, itemContext) =>
    expectString(value, itemContext)
  );
}

function parseArray<T>(
  payload: unknown,
  context: string,
  parser: (value: unknown, context: string) => T
): T[] {
  if (!Array.isArray(payload)) throw new Error(`${context} must be an array`);
  return payload.map((value, index) => parser(value, `${context}[${index}]`));
}

function parseJsonValue(payload: unknown, context: string): JsonValue {
  if (
    payload === null ||
    typeof payload === "string" ||
    typeof payload === "boolean"
  ) {
    return payload;
  }
  if (typeof payload === "number") return expectNumber(payload, context);
  if (Array.isArray(payload)) {
    return payload.map((value, index) => parseJsonValue(value, `${context}[${index}]`));
  }
  const record = expectJsonObject(payload, context);
  const parsedRecord: { [key: string]: JsonValue } = {};
  for (const [key, value] of Object.entries(record)) {
    parsedRecord[key] = parseJsonValue(value, `${context}.${key}`);
  }
  return parsedRecord;
}

function expectLifeRegime(value: unknown, field: string): LifeRegime {
  const regime = LIFE_REGIMES.find((candidate) => candidate === value);
  if (regime) return regime;
  throw new Error(`${field} must be a valid life regime`);
}

function expectNullableLifeRegime(value: unknown, field: string): LifeRegime | null {
  if (value === null) return null;
  return expectLifeRegime(value, field);
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
  return value;
}

function expectNullableBoolean(value: unknown, field: string): boolean | null {
  if (value === null) return null;
  return expectBoolean(value, field);
}

function expectNullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  return expectNumber(value, field);
}

function expectNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return expectString(value, field);
}
