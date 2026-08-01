export const HISTORY_FILTERS = ["last7", "last30", "week", "all"] as const;

export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export type HistoryLog = {
  date: string;
  status: string;
  updatedAt: string;
  energy: number | null;
  productivity: number | null;
  executionScore: number | null;
  stateScore: number | null;
  riskScore: number | null;
};

export type HistoryData = {
  filter: HistoryFilter;
  visibleDates: string[];
  logs: HistoryLog[];
  weeklySummary: {
    avgStateScore: number | null;
    avgRiskScore: number | null;
    submittedLogs: number;
    missingDays: number;
    activePhase: string;
  };
};

export function normalizeHistoryFilter(value: string | undefined): HistoryFilter {
  return HISTORY_FILTERS.find((filter) => filter === value) ?? "last30";
}
