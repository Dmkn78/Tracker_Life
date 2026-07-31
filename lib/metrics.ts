import type { CalendarEvent, DailyLog } from "@prisma/client";
import { addDays, getIsoWeekId, getWeekDateKeys, parseDateKey, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getCalendarContext, getTodoMetrics, type CalendarContext, type TodoMetrics } from "@/lib/todoMetrics";

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function clampCount(count: number, max = 7) {
  return Math.max(0, Math.min(max, Math.round(count)));
}

function weightedAverage(parts: Array<{ value: number | null | undefined; weight: number }>) {
  const available = parts.filter((part) => part.value != null);
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight === 0) return null;
  return available.reduce((sum, part) => sum + Number(part.value) * part.weight, 0) / totalWeight;
}

export function computeStateScore(log: Pick<DailyLog, "energy" | "productivity" | "startFriction" | "focusQuality" | "mentalFatigue">) {
  const score = weightedAverage([
    { value: log.energy, weight: 0.35 },
    { value: log.productivity, weight: 0.25 },
    { value: log.startFriction == null ? null : 100 - log.startFriction, weight: 0.2 },
    { value: log.focusQuality, weight: 0.1 },
    { value: log.mentalFatigue == null ? null : 100 - log.mentalFatigue, weight: 0.1 }
  ]);
  return score == null ? null : clampScore(score);
}

export function computeExecutionScore(
  log: Pick<DailyLog, "status" | "trainingDone" | "avoidedImportantTask">,
  metrics: TodoMetrics
) {
  let score = metrics.weightedCompletionRate * 82;
  if (log.status === "SUBMITTED") score += 8;
  if (log.trainingDone === true) score += 6;
  if (log.avoidedImportantTask === true) score -= 12;
  return clampScore(score);
}

export function computeRiskScore({
  log,
  metrics,
  calendar,
  missingLogs,
  previousRiskDelta,
  previousRiskAcceleration
}: {
  log: DailyLog;
  metrics: TodoMetrics;
  calendar: CalendarContext;
  missingLogs?: number;
  previousRiskDelta?: number | null;
  previousRiskAcceleration?: number | null;
}) {
  const energy = log.energy ?? 50;
  const productivity = log.productivity ?? 50;
  const startFriction = log.startFriction ?? 50;
  const caloriePercent = log.caloriePercent ?? 100;
  let risk = 14;

  if (energy < 35) risk += 18;
  else if (energy < 50) risk += 10;
  if (productivity < 35) risk += 16;
  else if (productivity < 50) risk += 8;
  if (startFriction > 75) risk += 16;
  else if (startFriction > 55) risk += 8;

  const calorieDeviation = Math.abs(caloriePercent - 100);
  if (calorieDeviation > 40) risk += 14;
  else if (calorieDeviation > 20) risk += 8;
  if (log.trainingDone === false) risk += 8;
  if ((log.mentalFatigue ?? 0) > 70) risk += 10;
  if ((log.physicalFatigue ?? 0) > 70) risk += 8;
  if (log.avoidedImportantTask === true) risk += 12;
  risk += Math.min(18, metrics.missedImportantTasks * 6);
  risk += Math.min(12, (missingLogs ?? 0) * 3);
  if (calendar.maxImpact === "CRITICAL") risk += 14;
  else if (calendar.maxImpact === "HIGH") risk += 9;
  risk += Math.min(8, Math.round(calendar.averageStress / 18));
  if ((previousRiskDelta ?? 0) > 0) risk += 4;
  if ((previousRiskAcceleration ?? 0) > 0) risk += 4;

  return clampScore(risk);
}

export function computeRiskDelta(todayRisk: number, previousRisk?: number | null) {
  return previousRisk == null ? 0 : todayRisk - previousRisk;
}

export function computeRiskAcceleration(todayDelta: number, previousDelta?: number | null) {
  return previousDelta == null ? 0 : todayDelta - previousDelta;
}

export async function computeWeeklySummary(userId: string, weekId = getIsoWeekId()) {
  const days = getWeekDateKeys(weekId);
  const logs = await prisma.dailyLog.findMany({
    where: { userId, date: { in: days.map(parseDateKey) } },
    orderBy: { date: "asc" }
  });
  const existing = new Map(logs.map((log) => [log.date.toISOString().slice(0, 10), log]));
  const values = (selector: (log: DailyLog) => number | null | undefined) =>
    logs.map(selector).filter((value): value is number => value != null);
  const avg = (items: number[]) => (items.length === 0 ? null : Math.round(items.reduce((sum, item) => sum + item, 0) / items.length));
  const missingDays = days.filter((day) => !existing.has(day));
  const skippedDays = Array.from(
    new Set(logs.filter((log) => log.status === "SKIPPED").map((log) => log.date.toISOString().slice(0, 10)))
  );
  const submittedDays = Array.from(
    new Set(logs.filter((log) => log.status === "SUBMITTED").map((log) => log.date.toISOString().slice(0, 10)))
  );
  const trainingDays = Array.from(
    new Set(logs.filter((log) => log.trainingDone === true).map((log) => log.date.toISOString().slice(0, 10)))
  );
  const calendarContext = await getCalendarContext(userId, days[0]);

  return {
    weekId,
    period: { start: days[0], end: days[6] },
    avgStateScore: avg(values((log) => log.stateScore)),
    avgRiskScore: avg(values((log) => log.riskScore)),
    avgExecutionScore: avg(values((log) => log.executionScore)),
    avgStartFriction: avg(values((log) => log.startFriction)),
    submittedLogs: clampCount(submittedDays.length, days.length),
    missingDays: clampCount(missingDays.length, days.length),
    missingDayKeys: missingDays,
    skippedDays: clampCount(skippedDays.length, days.length),
    skippedDayKeys: skippedDays,
    trainingDays: clampCount(trainingDays.length, days.length),
    activePhase: calendarContext.activePhase,
    calendarContext
  };
}

export function buildInterpretationMessages({
  logs,
  weeklySummary,
  calendarContext,
  executionImproved
}: {
  logs: DailyLog[];
  weeklySummary: Awaited<ReturnType<typeof computeWeeklySummary>>;
  calendarContext: CalendarContext;
  executionImproved?: boolean;
}) {
  const submitted = logs
    .filter((log) => log.status === "SUBMITTED" && log.riskScore != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const last3 = submitted.slice(-3);
  const messages: string[] = [];
  if (last3.length === 3 && last3.every((log, index, arr) => index === 0 || Number(log.riskScore) > Number(arr[index - 1].riskScore))) {
    messages.push("Risk is rising.");
  }
  if (last3.length === 3 && last3.every((log, index, arr) => index === 0 || Number(log.startFriction ?? 0) > Number(arr[index - 1].startFriction ?? 0))) {
    messages.push("Start friction is rising.");
  }
  if (executionImproved) messages.push("Execution is improving.");
  if (["exam_week", "interview_week", "deadline_week", "high_pressure_week"].includes(calendarContext.activePhase)) {
    messages.push("Current week contains high-context pressure.");
  }
  if (weeklySummary.missingDays > 0) messages.push("Data quality is incomplete this week.");
  if (messages.length === 0) messages.push("No strong regime shift signal is visible yet.");
  return messages;
}

export async function getTrajectory(userId: string, days = 30, endDate = toDateKey()) {
  const start = addDays(endDate, -(days - 1));
  const logs = await prisma.dailyLog.findMany({
    where: { userId, date: { gte: parseDateKey(start), lte: parseDateKey(endDate) } },
    orderBy: { date: "asc" }
  });
  const byDate = new Map(logs.map((log) => [log.date.toISOString().slice(0, 10), log]));
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const log = byDate.get(date);
    return {
      date,
      status: log?.status.toLowerCase() ?? "missing",
      stateScore: log?.stateScore ?? null,
      riskScore: log?.riskScore ?? null,
      executionScore: log?.executionScore ?? null,
      startFriction: log?.startFriction ?? null,
      productivity: log?.productivity ?? null,
      energy: log?.energy ?? null,
      caloriePercent: log?.caloriePercent ?? null
    };
  });
}

export async function buildWeeklyJsonExport(userId: string, weekId = getIsoWeekId()) {
  const summary = await computeWeeklySummary(userId, weekId);
  const days = await Promise.all(
    getWeekDateKeys(weekId).map(async (dateKey) => {
      const [log, todo, calendar] = await Promise.all([
        prisma.dailyLog.findUnique({ where: { userId_date: { userId, date: parseDateKey(dateKey) } } }),
        getTodoMetrics(userId, dateKey),
        getCalendarContext(userId, dateKey)
      ]);
      return {
        date: dateKey,
        status: (log?.status ?? "MISSING").toLowerCase(),
        inputs: {
          energy: log?.energy ?? null,
          productivity: log?.productivity ?? null,
          start_friction: log?.startFriction ?? null,
          calorie_target: log?.calorieTarget ?? null,
          calorie_percent: log?.caloriePercent ?? null,
          training_done: log?.trainingDone ?? null,
          mental_fatigue: log?.mentalFatigue ?? null,
          physical_fatigue: log?.physicalFatigue ?? null,
          focus_quality: log?.focusQuality ?? null,
          work_time_minutes: log?.workTimeMinutes ?? null,
          distraction_time_minutes: log?.distractionTimeMinutes ?? null,
          avoided_important_task: log?.avoidedImportantTask ?? null,
          main_blocker: log?.mainBlocker ?? null,
          improvement_tomorrow: log?.improvementTomorrow ?? null,
          text_summary: log?.textSummary ?? null,
          voice_transcript: log?.voiceTranscript ?? null
        },
        todo_metrics: {
          tasks_planned: todo.metrics.tasksPlanned,
          weighted_completion_rate: Number(todo.metrics.weightedCompletionRate.toFixed(2)),
          missed_high_importance_tasks: todo.metrics.missedImportantTasks,
          productive_task_completion: Number(todo.metrics.productiveTaskCompletion.toFixed(2))
        },
        calendar_context: {
          active_phase: calendar.activePhase,
          high_impact_events_next_7d: calendar.highImpactEventsNext7d,
          expected_stress_load: Math.round(calendar.averageStress),
          expected_preparation_load: Math.round(calendar.averagePreparationLoad)
        },
        computed_scores: {
          state_score: log?.stateScore ?? null,
          execution_score: log?.executionScore ?? null,
          risk_score: log?.riskScore ?? null,
          risk_delta: log?.riskDelta ?? null,
          risk_acceleration: log?.riskAcceleration ?? null
        }
      };
    })
  );
  const logs = await prisma.dailyLog.findMany({
    where: { userId, date: { gte: parseDateKey(summary.period.start), lte: parseDateKey(summary.period.end) } },
    orderBy: { date: "asc" }
  });
  const interpretation = buildInterpretationMessages({
    logs,
    weeklySummary: summary,
    calendarContext: summary.calendarContext
  });

  return {
    week_id: weekId,
    generated_at: new Date().toISOString(),
    period: summary.period,
    calendar_context: {
      active_phase: summary.calendarContext.activePhase,
      high_impact_events_next_7d: summary.calendarContext.highImpactEventsNext7d,
      expected_stress_load: Math.round(summary.calendarContext.averageStress),
      expected_preparation_load: Math.round(summary.calendarContext.averagePreparationLoad)
    },
    weekly_summary: {
      avg_state_score: summary.avgStateScore,
      avg_risk_score: summary.avgRiskScore,
      avg_execution_score: summary.avgExecutionScore,
      avg_start_friction: summary.avgStartFriction,
      submitted_logs: summary.submittedLogs,
      missing_days: summary.missingDays,
      skipped_days: summary.skippedDays,
      training_days: summary.trainingDays
    },
    days,
    missing_days: summary.missingDayKeys,
    skipped_days: summary.skippedDayKeys,
    interpretation
  };
}

export function serializeCalendarEvent(event: CalendarEvent | null) {
  if (!event) return null;
  return {
    id: event.id,
    title: event.title,
    type: event.type.toLowerCase(),
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    impact: event.impact.toLowerCase(),
    expectedStress: event.expectedStress,
    expectedPreparationLoad: event.expectedPreparationLoad
  };
}
