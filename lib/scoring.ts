import type { DailyLog } from "@prisma/client";
import { addDays, getIsoWeekId, parseDateKey } from "@/lib/dates";
import {
  computeWeeklySummary,
  computeExecutionScore,
  computeRiskAcceleration,
  computeRiskDelta,
  computeRiskScore,
  computeStateScore
} from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { computeRegime } from "@/lib/regime";
import { getCalendarContext, getTodoMetrics } from "@/lib/todoMetrics";

export async function recomputeDailyScores(userId: string, dateKey: string) {
  const log = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId, date: parseDateKey(dateKey) } }
  });
  if (!log) return null;

  const { metrics } = await getTodoMetrics(userId, dateKey);
  const calendar = await getCalendarContext(userId, dateKey);
  const previous = await prisma.dailyLog.findFirst({
    where: { userId, date: { lt: parseDateKey(dateKey) }, riskScore: { not: null } },
    orderBy: { date: "desc" }
  });
  const previousSubmitted = await prisma.dailyLog.findFirst({
    where: { userId, date: { lt: parseDateKey(dateKey) }, status: "SUBMITTED" },
    orderBy: { date: "desc" }
  });
  const recentSubmittedLogs = await prisma.dailyLog.findMany({
    where: { userId, date: { lte: parseDateKey(dateKey) }, status: "SUBMITTED" },
    orderBy: { date: "desc" },
    take: 14
  });
  const weekStart = new Date(parseDateKey(dateKey));
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() || 7) - 1));
  const missingLogs = await prisma.dailyLog.count({
    where: { userId, date: { gte: weekStart, lt: parseDateKey(dateKey) }, status: "MISSING" }
  });
  const executionScore = computeExecutionScore(log, metrics);
  const stateScore = computeStateScore(log);
  const riskScore = computeRiskScore({
    log,
    metrics,
    calendar,
    missingLogs,
    previousRiskDelta: previous?.riskDelta,
    previousRiskAcceleration: previous?.riskAcceleration
  });
  const riskDelta = computeRiskDelta(riskScore, previous?.riskScore);
  const riskAcceleration = computeRiskAcceleration(riskDelta, previous?.riskDelta);
  const weeklySummary = await computeWeeklySummary(userId, getIsoWeekId(dateKey));
  const regime = computeRegime({
    currentLog: { ...log, executionScore, stateScore, riskScore, riskDelta, riskAcceleration },
    previousSubmittedLog: previousSubmitted,
    recentSubmittedLogs: recentSubmittedLogs.toReversed(),
    calendar,
    todoMetrics: metrics,
    missingDaysThisWeek: weeklySummary.missingDays
  });

  return prisma.dailyLog.update({
    where: { id: log.id },
    data: {
      executionScore,
      stateScore,
      riskScore,
      riskDelta,
      riskAcceleration,
      regime: regime.regime,
      regimeConfidence: regime.confidence
    }
  });
}

export async function recomputeAroundDate(userId: string, dateKey: string) {
  const updated = await recomputeDailyScores(userId, dateKey);
  const tomorrow = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId, date: parseDateKey(addDays(dateKey, 1)) } }
  });
  if (tomorrow) await recomputeDailyScores(userId, addDays(dateKey, 1));
  return updated;
}

export function serializeDailyLog(log: DailyLog | null) {
  if (!log) return null;
  return {
    id: log.id,
    date: log.date.toISOString().slice(0, 10),
    status: log.status.toLowerCase(),
    energy: log.energy,
    productivity: log.productivity,
    startFriction: log.startFriction,
    calorieTarget: log.calorieTarget,
    caloriePercent: log.caloriePercent,
    trainingDone: log.trainingDone,
    mentalFatigue: log.mentalFatigue,
    physicalFatigue: log.physicalFatigue,
    focusQuality: log.focusQuality,
    workTimeMinutes: log.workTimeMinutes,
    distractionTimeMinutes: log.distractionTimeMinutes,
    avoidedImportantTask: log.avoidedImportantTask,
    mainBlocker: log.mainBlocker,
    improvementTomorrow: log.improvementTomorrow ?? "",
    sleepIntentClickedAt: log.sleepIntentClickedAt?.toISOString() ?? null,
    estimatedSleepDelayMin: log.estimatedSleepDelayMin,
    estimatedSleepStart: log.estimatedSleepStart?.toISOString() ?? null,
    textSummary: log.textSummary ?? "",
    voiceTranscript: log.voiceTranscript ?? "",
    executionScore: log.executionScore,
    stateScore: log.stateScore,
    riskScore: log.riskScore,
    riskDelta: log.riskDelta,
    riskAcceleration: log.riskAcceleration,
    regime: log.regime,
    regimeConfidence: log.regimeConfidence,
    submittedAt: log.submittedAt?.toISOString() ?? null,
    updatedAt: log.updatedAt.toISOString()
  };
}
