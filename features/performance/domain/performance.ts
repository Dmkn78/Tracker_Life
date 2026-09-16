export type PerformancePeriod = {
  minutes: number;
  focusMinutes: number;
  tasks: number;
  objectives: number;
  capitalCents: number;
  productiveDays: number;
};

export type PerformanceReward = { id: string; date: string; title: string; reason: string; capitalCents: number };
export type PerformanceSession = { id: string; date: string; title: string; actualMinutes: number; executionStatus: string };
export type ExecutionStatus = "planned" | "done" | "partial" | "not_done";

export type PerformanceData = {
  rewardPolicy: {
    hourlyCents: number;
    taskCents: number;
    priorityTaskCents: number;
    milestoneCents: number;
    objectiveCents: number;
    projectCents: number;
    deadlineBonusCents: number;
    focusBonusCents: number;
    streakBonusCents: number;
  };
  today: string;
  profileName: string;
  index: number;
  execution: number | null;
  focusScore: number;
  consistency: number;
  streak: number;
  daily: PerformancePeriod;
  week: PerformancePeriod;
  previousWeek: PerformancePeriod;
  month: PerformancePeriod;
  total: PerformancePeriod;
  targetMinutes: number;
  expectedMinutes: number;
  gapMinutes: number;
  remainingMinutes: number;
  requiredDailyMinutes: number;
  status: string;
  nextStatus: string | null;
  nextCapitalCents: number;
  nextProductiveDays: number;
  statusProgress: number;
  undatedCompletions: number;
  history: (PerformancePeriod & { start: string; targetMinutes: number })[];
  monthlyHistory: (PerformancePeriod & { start: string })[];
  rewards: PerformanceReward[];
  recentSessions: PerformanceSession[];
  objectiveOptions: { id: string; title: string }[];
};

export function formatWorkTime(minutes: number): string {
  const rounded = Math.round(Math.abs(minutes));
  return `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, "0")}`;
}

export function formatCapital(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

export function createPerformanceProfile(performance: PerformanceData): string {
  return ["PERFORMANCE PROFILE", performance.profileName, `As of ${performance.today}`,
    `Status: ${performance.status}`, `Performance Index: ${performance.index}/100`,
    `This week: ${formatWorkTime(performance.week.minutes)} productive work`,
    `Focused work: ${formatWorkTime(performance.week.focusMinutes)}`,
    `Output: ${performance.week.tasks} tasks · ${performance.week.objectives} objectives`,
    `Current streak: ${performance.streak} days`,
    `Weekly generated value: ${formatCapital(performance.week.capitalCents)}`,
    "Personal, self-reported metrics. Generated value is fictional; no cash value."].join("\n");
}
