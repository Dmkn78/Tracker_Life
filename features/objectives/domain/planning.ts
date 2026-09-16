import type { ObjectiveTask, WeeklyPlanBlock } from "./objective";

export type PlanningTask = ObjectiveTask & {
  optimisticMinutes: number;
  likelyMinutes: number;
  pessimisticMinutes: number;
  predecessorIds: string[];
};

export type PlanningBlock = WeeklyPlanBlock & {
  recoveryAction: string | null;
  replacementId: string | null;
};

export type CriticalPathTask = {
  id: string;
  title: string;
  predecessorIds: string[];
  expectedMinutes: number;
  startMinutes: number;
  slackMinutes: number;
  critical: boolean;
};

export type ObjectiveInsight = {
  objectiveId: string;
  objectiveIds: string[];
  progress: number;
  progressMode: string;
  startDate: string;
  effortMinutes: number;
  impact: number;
  expectedProgress: number | null;
  gap: number | null;
  velocity: number | null;
  momentum: number | null;
  requiredVelocity: number | null;
  forecastDate: string | null;
  slipDays: number | null;
  onTimeProbability: number | null;
  observationCount: number;
  health: number | null;
  executionRate: number | null;
  actualMinutes: number;
  plannedMonthMinutes: number;
  actualMonthMinutes: number;
  recoveryMinutes: number | null;
  recoveryDays: number;
  recoveryDailyMinutes: number;
  ignoredUntil: string | null;
  history: { date: string; progress: number }[];
  taskIds: string[];
  network: { totalMinutes: number; missingEstimates: number; tasks: CriticalPathTask[] };
};

export type PlanningData = {
  today: string;
  month: string;
  weeks: { start: string; end: string; label: string }[];
  insights: ObjectiveInsight[];
  recommendations: { objectiveId: string; reason: string }[];
  blocks: PlanningBlock[];
  tasks: PlanningTask[];
};

export type PlanningMutation =
  | { path: "recovery-schedule"; method: "POST"; body: { requestId: string; objectiveId: string; startDate: string; days: number; dailyMinutes: number } }
  | { path: "settings"; method: "PATCH"; body: { objectiveId: string; startDate: string; effortMinutes: number; impact: number; manualProgress: number | null } }
  | { path: "checkpoint"; method: "POST"; body: { objectiveId: string; date: string; progress: number } }
  | { path: "task"; method: "PATCH"; body: { taskId: string; optimisticMinutes: number; likelyMinutes: number; pessimisticMinutes: number; predecessorIds: string[] } }
  | { path: "recovery"; method: "POST"; body: { blockId: string; action: "ignore" | "replan"; date?: string; durationMinutes?: number } }
  | { path: "decision"; method: "POST"; body: { objectiveId: string; action: "ignore" | "accept_forecast" | "reduce_scope"; forecastDate?: string; effortMinutes?: number } }
  | { path: "reallocate"; method: "POST"; body: { blockId: string; objectiveId: string } };

export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function hours(minutes: number): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(minutes / 60)}h`;
}

export function signed(value: number | null, unit = ""): string {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value}${unit}`;
}
