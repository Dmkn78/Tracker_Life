import type { CalendarContext, TodoMetrics } from "@/lib/todoMetrics";

export const REGIMES = ["stable", "productive", "pressure", "recovery", "drift", "burnout_risk", "chaotic"] as const;

export type Regime = (typeof REGIMES)[number];

export type RegimeLog = {
  date?: Date | string;
  status?: string | null;
  energy?: number | null;
  productivity?: number | null;
  startFriction?: number | null;
  trainingDone?: boolean | null;
  stateScore?: number | null;
  executionScore?: number | null;
  riskScore?: number | null;
  riskDelta?: number | null;
  riskAcceleration?: number | null;
  regime?: string | null;
};

export type RegimeDetection = {
  regime: Regime;
  confidence: number;
  why: string[];
  lastRegime: Regime | null;
  changed: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeStatus(status?: string | null) {
  return (status ?? "").toUpperCase();
}

function normalizeRegime(value?: string | null): Regime | null {
  return REGIMES.includes(value as Regime) ? (value as Regime) : null;
}

function riskLevel(riskScore?: number | null) {
  const risk = riskScore ?? 0;
  if (risk >= 75) return "critical";
  if (risk >= 60) return "high";
  if (risk >= 40) return "medium";
  return "low";
}

export function computeRegime({
  currentLog,
  previousSubmittedLog,
  recentSubmittedLogs,
  calendar,
  todoMetrics,
  missingDaysThisWeek
}: {
  currentLog: RegimeLog | null;
  previousSubmittedLog?: RegimeLog | null;
  recentSubmittedLogs: RegimeLog[];
  calendar: CalendarContext;
  todoMetrics: TodoMetrics;
  missingDaysThisWeek: number;
}): RegimeDetection {
  const log = currentLog ?? {};
  const previous = previousSubmittedLog ?? null;
  const submitted = recentSubmittedLogs.filter((item) => normalizeStatus(item.status) === "SUBMITTED");
  const dataIncomplete = !currentLog || normalizeStatus(log.status) !== "SUBMITTED" || missingDaysThisWeek > 1;
  const highRiskStreak = submitted.slice(-3).filter((item) => (item.riskScore ?? 0) > 75).length >= 2;
  const executionFalling =
    previous?.executionScore != null && log.executionScore != null && log.executionScore < previous.executionScore - 8;
  const stateStable =
    previous?.stateScore != null && log.stateScore != null && Math.abs(log.stateScore - previous.stateScore) <= 6;
  const pressureSignal =
    calendar.highImpactEventsNext7d > 0 ||
    calendar.averageStress >= 68 ||
    calendar.weeklyExpectedStressLoad >= 70 ||
    calendar.maxImpact === "HIGH" ||
    calendar.maxImpact === "CRITICAL";
  const riskDecreasing = (log.riskDelta ?? 0) < -4 || (previous?.riskScore != null && log.riskScore != null && log.riskScore < previous.riskScore - 4);
  const lastRegime = normalizeRegime(previous?.regime);

  let regime: Regime = "stable";
  let confidence = 58;
  const why: string[] = [];

  if ((log.riskScore ?? 0) > 75 && highRiskStreak) {
    regime = "burnout_risk";
    confidence = 88;
    why.push("Risk score is above 75 across multiple submitted logs.");
  } else if ((log.energy ?? 100) < 35 && (log.startFriction ?? 0) > 70) {
    regime = "burnout_risk";
    confidence = 84;
    why.push("Energy is below 35 while start friction is above 70.");
  } else if ((log.riskAcceleration ?? 0) >= 14 && dataIncomplete) {
    regime = "chaotic";
    confidence = 78;
    why.push("Risk acceleration is high and data quality is incomplete.");
  } else if (pressureSignal) {
    regime = "pressure";
    confidence = 72 + Math.min(18, calendar.highImpactEventsNext7d * 5);
    why.push("Calendar pressure is elevated by upcoming high-impact context.");
  } else if ((log.executionScore ?? 0) > 70 && (log.riskScore ?? 100) < 50) {
    regime = "productive";
    confidence = 76;
    why.push("Execution is above 70 while risk remains below 50.");
  } else if (log.trainingDone === true && riskDecreasing) {
    regime = "recovery";
    confidence = 70;
    why.push("Training is done and risk is decreasing.");
  } else if (missingDaysThisWeek > 0 || executionFalling || todoMetrics.weightedCompletionRate < 0.35) {
    regime = "drift";
    confidence = 66 + Math.min(16, missingDaysThisWeek * 4);
    if (missingDaysThisWeek > 0) why.push("Daily log coverage is incomplete this week.");
    if (executionFalling) why.push("Execution score is decreasing versus the previous submitted log.");
    if (todoMetrics.weightedCompletionRate < 0.35) why.push("Task completion is below 35%.");
  } else if (stateStable && riskLevel(log.riskScore) !== "high" && riskLevel(log.riskScore) !== "critical") {
    regime = "stable";
    confidence = 72;
    why.push("State is stable and risk is moderate or low.");
  }

  if (why.length === 0) {
    why.push("No strong pressure, drift, recovery, or burnout signal dominates today.");
  }

  return {
    regime,
    confidence: clamp(confidence),
    why,
    lastRegime,
    changed: lastRegime != null && lastRegime !== regime
  };
}

export function computeRegimeTransition(current: Regime, target: Regime, calendar: CalendarContext) {
  if (current === target) return 0.48;
  if (target === "pressure" && calendar.highImpactEventsNext7d > 0) return 0.24;
  if (target === "burnout_risk" && calendar.averageStress > 75) return 0.14;
  if (target === "drift") return 0.14;
  if (target === "recovery") return 0.1;
  return 0.06;
}

export function simulateNextWeek(regime: RegimeDetection, calendar: CalendarContext) {
  const raw = REGIMES.map((target) => ({
    regime: target,
    probability: computeRegimeTransition(regime.regime, target, calendar)
  }));
  const total = raw.reduce((sum, item) => sum + item.probability, 0) || 1;
  return raw
    .map((item) => ({ regime: item.regime, probability: clamp((item.probability / total) * 100) }))
    .sort((a, b) => b.probability - a.probability);
}

export function buildTransitionMatrixPlaceholder(regime: RegimeDetection, calendar: CalendarContext) {
  return REGIMES.map((from) => {
    const row = REGIMES.map((to) => computeRegimeTransition(from, to, calendar));
    const total = row.reduce((sum, value) => sum + value, 0) || 1;
    return {
      from,
      active: from === regime.regime,
      probabilities: REGIMES.reduce<Record<Regime, number>>((acc, to, index) => {
        acc[to] = clamp((row[index] / total) * 100);
        return acc;
      }, {} as Record<Regime, number>)
    };
  });
}
