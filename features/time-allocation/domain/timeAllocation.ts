export type TimeAllocationRow = {
  id: string;
  name: string;
  objective: string;
  targetWeight: number;
  actualWeight: number;
  weekWeight: number;
  plannedMinutes: number;
  autoPlannedMinutes: number;
  plannedMinutesStored: number;
  plannedMinutesManual: boolean;
  actualMinutes: number;
  weekActualMinutes: number;
  expectedReturn: number;
  risk: number;
  beta: number;
  color: string;
  active: boolean;
};

export type TimeAllocationMetrics = {
  targetReturn: number;
  actualReturn: number;
  targetRisk: number;
  actualRisk: number;
  beta: number;
  capmExpectedReturn: number;
  sharpeLike: number;
};

export type TimeAllocationData = {
  date: string;
  weekId: string;
  dayBudgetMinutes: number;
  targetWeightTotal: number;
  plannedMinutesTotal: number;
  plannedMinutesAutoTotal: number;
  actualMinutesTotal: number;
  weekActualMinutesTotal: number;
  remainingBudgetMinutes: number;
  overBudgetMinutes: number;
  hasManualPlanOverrides: boolean;
  rows: TimeAllocationRow[];
  metrics: TimeAllocationMetrics;
};

export type TimeAllocationDraft = {
  id?: string;
  name: string;
  objective: string;
  targetWeight: number;
  plannedMinutes: number;
  plannedMinutesManual: boolean;
  actualMinutes: number;
  color: string;
};

export type TaskTimeBreakdownPeriod = "week" | "month";

export type TaskTimeBreakdownEntry = {
  id: string;
  name: string;
  color: string;
  minutes: number;
};

export type TaskTimeBreakdown = {
  period: TaskTimeBreakdownPeriod;
  rangeStart: string;
  rangeEnd: string;
  totalMinutes: number;
  taskCount: number;
  byCompany: TaskTimeBreakdownEntry[];
  noCompanyMinutes: number;
  byTag: TaskTimeBreakdownEntry[];
  untaggedMinutes: number;
};
