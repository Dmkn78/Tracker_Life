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

/** Inclusive range ending today: a 7-day preset covers today and the 6 previous days. */
export function periodFromPreset(preset: PeriodPreset, todayKey: string): AnalysisPeriod {
  const end = new Date(`${todayKey}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (preset - 1));
  const period: AnalysisPeriod = { from: start.toISOString().slice(0, 10), to: todayKey };
  return period;
}

export function hasAnyActivity(patterns: HistoryPatterns): boolean {
  const isActive = patterns.planned > 0 || patterns.daysWithRecap > 0;
  return isActive;
}
