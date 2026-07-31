import type { CalendarEvent, DailyLog, Task } from "@prisma/client";
import { addDays, getIsoWeekId, getWeekDateKeys, parseDateKey, toDateKey } from "@/lib/dates";
import { buildWeeklyJsonExport, computeWeeklySummary, getTrajectory, serializeCalendarEvent } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { computeRegime, simulateNextWeek, buildTransitionMatrixPlaceholder, type RegimeDetection } from "@/lib/regime";
import { getTimeAllocationData } from "@/lib/timeAllocation";
import { calculateTodoMetrics, getCalendarContext, getNextHighImpactEvent, getTodoMetrics } from "@/lib/todoMetrics";

const impactPressure = {
  LOW: 24,
  MEDIUM: 48,
  HIGH: 76,
  CRITICAL: 94
};

function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function taskDate(task: Task) {
  return dateKeyFromDate(task.date);
}

function eventDate(event: CalendarEvent) {
  return dateKeyFromDate(event.start);
}

function serializeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    date: taskDate(task),
    importance: task.importance.toLowerCase(),
    productive: task.productive,
    estimatedMinutes: task.estimatedMinutes,
    completionPercent: task.completionPercent,
    status: task.status.toLowerCase(),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function pressureForEvents(events: CalendarEvent[]) {
  if (events.length === 0) return 0;
  const strongestImpact = Math.max(...events.map((event) => impactPressure[event.impact]));
  const averageLoad = Math.round(
    events.reduce((sum, event) => sum + (event.expectedStress + event.expectedPreparationLoad) / 2, 0) / events.length
  );
  return Math.min(100, Math.round(strongestImpact * 0.6 + averageLoad * 0.4));
}

function riskBand(riskScore?: number | null) {
  const risk = riskScore ?? 0;
  if (risk >= 75) return "critical";
  if (risk >= 60) return "high";
  if (risk >= 40) return "medium";
  return "low";
}

function trendValue(today?: number | null, previous?: number | null) {
  if (today == null || previous == null) return 0;
  return today - previous;
}

function dataQualityStatus(enoughForTrend: boolean, submittedLogs: number, missingDays: number) {
  if (enoughForTrend && missingDays === 0) return "complete";
  if (submittedLogs > 0) return "partial";
  return "missing";
}

function buildTasksByDay(tasks: Task[], weekDays: string[]) {
  return weekDays.map((date) => ({
    date,
    tasks: tasks.filter((task) => taskDate(task) === date).map(serializeTask)
  }));
}

function buildWeeklyPlanner(tasks: Task[], events: CalendarEvent[], weekDays: string[]) {
  const topPriorities = tasks
    .filter((task) => task.importance === "HIGH" && task.status !== "DONE" && task.status !== "CANCELLED")
    .sort((a, b) => b.completionPercent - a.completionPercent)
    .slice(0, 3)
    .map(serializeTask);
  const majorEvents = events
    .filter((event) => ["HIGH", "CRITICAL"].includes(event.impact) || ["EXAM", "INTERVIEW", "DEADLINE"].includes(event.type))
    .map(serializeCalendarEvent)
    .filter(isPresent);
  const firstPriority = topPriorities[0]?.title;
  const firstEvent = majorEvents[0]?.title;

  return {
    objective: firstEvent ? `Prepare for ${firstEvent}` : firstPriority ? `Execute: ${firstPriority}` : "No explicit weekly objective",
    topPriorities,
    tasksByDay: buildTasksByDay(tasks, weekDays),
    majorEvents,
    missingPlanningWarning: topPriorities.length === 0
  };
}

function buildLifeTape({
  todayLog,
  previousLog,
  todoMetrics,
  calendarPressure
}: {
  todayLog: DailyLog | null;
  previousLog: DailyLog | null;
  todoMetrics: ReturnType<typeof calculateTodoMetrics>;
  calendarPressure: number;
}) {
  const state = todayLog?.stateScore ?? null;
  const risk = todayLog?.riskScore ?? null;
  const execution = todayLog?.executionScore ?? Math.round(todoMetrics.weightedCompletionRate * 100);
  const friction = todayLog?.startFriction ?? null;
  const energy = todayLog?.energy ?? null;
  const items = [
    { label: "STATE", value: state, delta: trendValue(state, previousLog?.stateScore), inverted: false },
    { label: "RISK", value: risk, delta: trendValue(risk, previousLog?.riskScore), inverted: true },
    { label: "EXECUTION", value: execution, delta: trendValue(execution, previousLog?.executionScore), inverted: false },
    { label: "FRICTION", value: friction, delta: trendValue(friction, previousLog?.startFriction), inverted: true },
    { label: "ENERGY", value: energy, delta: trendValue(energy, previousLog?.energy), inverted: false }
  ];

  return {
    items,
    calendarPressureLabel: calendarPressure >= 70 ? "HIGH" : calendarPressure >= 45 ? "MEDIUM" : "LOW"
  };
}

export async function getLifeTerminalData(today = toDateKey()) {
  const user = await import("@/lib/auth").then((module) => module.requireUser());
  const weekId = getIsoWeekId(today);
  const weekDays = getWeekDateKeys(weekId);
  const rangeStart = addDays(today, -29);
  const rangeEnd = addDays(today, 30);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const [
    todayLog,
    previousSubmittedLog,
    recentSubmittedLogs,
    todayTodo,
    calendarContext,
    nextHighImpactEvent,
    trajectory,
    weeklySummary,
    rangeEvents,
    weekEvents,
    rangeTasks,
    weekTasks,
    weeklyExport,
    timeAllocation
  ] = await Promise.all([
    prisma.dailyLog.findUnique({ where: { userId_date: { userId: user.id, date: parseDateKey(today) } } }),
    prisma.dailyLog.findFirst({ where: { userId: user.id, date: { lt: parseDateKey(today) }, status: "SUBMITTED" }, orderBy: { date: "desc" } }),
    prisma.dailyLog.findMany({ where: { userId: user.id, date: { lte: parseDateKey(today) }, status: "SUBMITTED" }, orderBy: { date: "desc" }, take: 14 }),
    getTodoMetrics(user.id, today),
    getCalendarContext(user.id, today),
    getNextHighImpactEvent(user.id, today),
    getTrajectory(user.id, 30, today),
    computeWeeklySummary(user.id, weekId),
    prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        start: { gte: parseDateKey(rangeStart), lt: parseDateKey(addDays(rangeEnd, 1)) }
      },
      orderBy: { start: "asc" }
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        start: { gte: parseDateKey(weekStart), lt: parseDateKey(addDays(weekEnd, 1)) }
      },
      orderBy: { start: "asc" }
    }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        date: { gte: parseDateKey(rangeStart), lte: parseDateKey(rangeEnd) }
      },
      orderBy: [{ date: "asc" }, { importance: "desc" }, { createdAt: "asc" }]
    }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        date: { gte: parseDateKey(weekStart), lte: parseDateKey(weekEnd) }
      },
      orderBy: [{ date: "asc" }, { importance: "desc" }, { createdAt: "asc" }]
    }),
    buildWeeklyJsonExport(user.id, weekId),
    getTimeAllocationData(user.id, today)
  ]);

  const calendarPressureToday = pressureForEvents(rangeEvents.filter((event) => eventDate(event) === today));
  const regime = computeRegime({
    currentLog: todayLog,
    previousSubmittedLog,
    recentSubmittedLogs: recentSubmittedLogs.toReversed(),
    calendar: calendarContext,
    todoMetrics: todayTodo.metrics,
    missingDaysThisWeek: weeklySummary.missingDays
  });
  const submittedTrendLogs = trajectory.filter((point) => point.status === "submitted" && point.stateScore != null).length;
  const enrichedTrajectory = trajectory.map((point) => {
    const events = rangeEvents.filter((event) => eventDate(event) === point.date);
    const tasks = rangeTasks.filter((task) => taskDate(task) === point.date);
    return {
      ...point,
      calendarPressure: pressureForEvents(events),
      todoCompletion: Math.round(calculateTodoMetrics(tasks).weightedCompletionRate * 100)
    };
  });
  const previousForTape = previousSubmittedLog ?? null;
  const activeTasks = rangeTasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED");
  const taskSections = {
    today: weekTasks.filter((task) => taskDate(task) === today).map(serializeTask),
    thisWeek: weekTasks.map(serializeTask),
    overdue: activeTasks.filter((task) => taskDate(task) < today).map(serializeTask),
    highImportance: activeTasks.filter((task) => task.importance === "HIGH").map(serializeTask),
    productive: activeTasks.filter((task) => task.productive).map(serializeTask)
  };
  const weeklyTaskMetrics = calculateTodoMetrics(weekTasks);

  return {
    today,
    weekId,
    terminalHeader: {
      date: today,
      weekId,
      regime: regime.regime,
      phase: calendarContext.activePhase,
      dailyLogStatus: (todayLog?.status ?? "MISSING").toLowerCase(),
      nextHighImpactEvent: serializeCalendarEvent(nextHighImpactEvent),
      dataQuality: dataQualityStatus(submittedTrendLogs >= 3, weeklySummary.submittedLogs, weeklySummary.missingDays),
      risk: riskBand(todayLog?.riskScore)
    },
    lifeTape: buildLifeTape({
      todayLog,
      previousLog: previousForTape,
      todoMetrics: todayTodo.metrics,
      calendarPressure: Math.max(calendarPressureToday, Math.round(calendarContext.averageStress))
    }),
    regime,
    quant: {
      projection: simulateNextWeek(regime, calendarContext),
      transitionMatrix: buildTransitionMatrixPlaceholder(regime, calendarContext)
    },
    calendarContext: {
      ...calendarContext,
      nextHighImpactEvent: serializeCalendarEvent(nextHighImpactEvent),
      pressureLevel: Math.max(calendarPressureToday, Math.round(calendarContext.averageStress))
    },
    trajectory: enrichedTrajectory,
    enoughForTrend: submittedTrendLogs >= 3,
    initialEvents: rangeEvents.map(serializeCalendarEvent).filter(isPresent),
    taskSections,
    taskMetrics: {
      today: todayTodo.metrics,
      week: weeklyTaskMetrics,
      plannedVsDone: {
        planned: weekTasks.filter((task) => task.status !== "CANCELLED").length,
        done: weekTasks.filter((task) => task.status === "DONE" || task.completionPercent >= 100).length
      }
    },
    timeAllocation: {
      dayBudgetMinutes: timeAllocation.dayBudgetMinutes,
      targetWeightTotal: timeAllocation.targetWeightTotal,
      actualMinutesTotal: timeAllocation.actualMinutesTotal,
      plannedMinutesTotal: timeAllocation.rows.reduce((sum: number, row) => sum + row.plannedMinutes, 0),
      rows: timeAllocation.rows.map((row) => ({
        id: row.id,
        name: row.name,
        objective: row.objective,
        targetWeight: row.targetWeight,
        actualWeight: row.actualWeight,
        plannedMinutes: row.plannedMinutes,
        autoPlannedMinutes: row.autoPlannedMinutes,
        plannedMinutesManual: row.plannedMinutesManual,
        actualMinutes: row.actualMinutes,
        color: row.color
      }))
    },
    quickLog: todayLog
      ? {
          date: today,
          status: todayLog.status.toLowerCase(),
          energy: todayLog.energy ?? 50,
          productivity: todayLog.productivity ?? 50,
          startFriction: todayLog.startFriction ?? 50,
          calorieTarget: todayLog.calorieTarget ?? user.calorieTarget,
          caloriePercent: todayLog.caloriePercent ?? 100,
          trainingDone: todayLog.trainingDone,
          mentalFatigue: todayLog.mentalFatigue ?? 50,
          physicalFatigue: todayLog.physicalFatigue ?? 50,
          focusQuality: todayLog.focusQuality ?? 50,
          workTimeMinutes: todayLog.workTimeMinutes ?? 0,
          distractionTimeMinutes: todayLog.distractionTimeMinutes ?? 0,
          avoidedImportantTask: todayLog.avoidedImportantTask,
          mainBlocker: todayLog.mainBlocker ?? "none",
          improvementTomorrow: todayLog.improvementTomorrow ?? "",
          sleepIntentClickedAt: todayLog.sleepIntentClickedAt?.toISOString() ?? null,
          estimatedSleepDelayMin: todayLog.estimatedSleepDelayMin ?? user.defaultSleepDelayMin,
          textSummary: todayLog.textSummary ?? "",
          voiceTranscript: todayLog.voiceTranscript ?? ""
        }
      : {
          date: today,
          status: "draft",
          energy: 50,
          productivity: 50,
          startFriction: 50,
          calorieTarget: user.calorieTarget,
          caloriePercent: 100,
          trainingDone: null,
          mentalFatigue: 50,
          physicalFatigue: 50,
          focusQuality: 50,
          workTimeMinutes: 0,
          distractionTimeMinutes: 0,
          avoidedImportantTask: null,
          mainBlocker: "none",
          improvementTomorrow: "",
          sleepIntentClickedAt: null,
          estimatedSleepDelayMin: user.defaultSleepDelayMin,
          textSummary: "",
          voiceTranscript: ""
        },
    weeklyPlanner: buildWeeklyPlanner(weekTasks, weekEvents, weekDays),
    dataQuality: {
      submittedLogsThisWeek: weeklySummary.submittedLogs,
      missingDays: weeklySummary.missingDays,
      missingDayKeys: weeklySummary.missingDayKeys,
      calendarEvents: weekEvents.length,
      tasksTracked: weekTasks.length,
      enoughDataForTrend: submittedTrendLogs >= 3,
      enoughDataForRegimeDetection: recentSubmittedLogs.length >= 2 || todayLog != null,
      weeklyExportPreview: weeklyExport
    }
  };
}
