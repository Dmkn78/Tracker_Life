export type EvidenceRecord = { date: string | null; text: string };
export type RecurringItem = { label: string; count: number; doneCount: number; evidence: EvidenceRecord[] };
export type WeekdayRate = { weekday: string; planned: number; done: number };
export type ObjectiveActivity = { title: string; planned: number; done: number };

export type HistoryPatterns = {
  planned: number;
  done: number;
  dropped: number;
  open: number;
  completionRate: number;
  daysWithRecap: number;
  dayCount: number;
  weekdayRates: WeekdayRate[];
  recurringTasks: RecurringItem[];
  postponedTasks: RecurringItem[];
  recurringBlockers: RecurringItem[];
  blockerKeywords: RecurringItem[];
  objectiveActivity: ObjectiveActivity[];
  idleObjectives: string[];
};

export type AnalysisPeriod = { from: string; to: string };

export type CitedStatement = { text: string; sources: string[] };

export type InsightSource = { id: string; kind: string; date: string | null; title: string; text: string; path: string | null };

export type InsightAnswer = {
  summary: string;
  facts: CitedStatement[];
  hypotheses: CitedStatement[];
  recommendations: CitedStatement[];
  unverified: CitedStatement[];
};

export type InsightResult = { period: AnalysisPeriod; answer: InsightAnswer; sources: InsightSource[]; evidenceCount: number; isTruncated: boolean };

export type PeriodPreset = 7 | 28 | 90;

export const PERIOD_PRESETS: readonly PeriodPreset[] = [7, 28, 90];
/** Same limit as the API (one year). */
export const MAX_CUSTOM_PERIOD_DAYS = 366;

export type CustomPeriodProblem = "missing" | "reversed" | "too-long";

/** Inclusive range ending today: a 7-day preset covers today and the 6 previous days. */
export function periodFromPreset(preset: PeriodPreset, todayKey: string): AnalysisPeriod {
  const end = new Date(`${todayKey}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (preset - 1));
  const period: AnalysisPeriod = { from: start.toISOString().slice(0, 10), to: todayKey };
  return period;
}

export function findCustomPeriodProblem(period: AnalysisPeriod): CustomPeriodProblem | null {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(period.from) || !datePattern.test(period.to)) return "missing";
  if (period.from > period.to) return "reversed";
  const lengthInDays = (Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86_400_000 + 1;
  const problem = lengthInDays > MAX_CUSTOM_PERIOD_DAYS ? "too-long" : null;
  return problem;
}

export function hasAnyActivity(patterns: HistoryPatterns): boolean {
  const isActive = patterns.planned > 0 || patterns.daysWithRecap > 0;
  return isActive;
}
