import {
  expectJsonObject,
  expectNumber,
  expectString,
  expectStringArray,
  parseJsonArray
} from "@/lib/http/apiClient";
import {
  HISTORY_FILTERS,
  type HistoryData,
  type HistoryFilter,
  type HistoryLog
} from "../domain/history";

export function parseHistoryData(payload: unknown): HistoryData {
  const data = expectJsonObject(payload, "history response");
  const weeklySummary = expectJsonObject(
    data.weeklySummary,
    "history response.weeklySummary"
  );
  return {
    filter: expectHistoryFilter(data.filter, "history response.filter"),
    visibleDates: expectStringArray(data.visibleDates, "history response.visibleDates"),
    logs: parseJsonArray(data.logs, "history response.logs", parseHistoryLog),
    weeklySummary: {
      avgStateScore: expectNullableNumber(
        weeklySummary.avgStateScore,
        "history response.weeklySummary.avgStateScore"
      ),
      avgRiskScore: expectNullableNumber(
        weeklySummary.avgRiskScore,
        "history response.weeklySummary.avgRiskScore"
      ),
      submittedLogs: expectNumber(
        weeklySummary.submittedLogs,
        "history response.weeklySummary.submittedLogs"
      ),
      missingDays: expectNumber(
        weeklySummary.missingDays,
        "history response.weeklySummary.missingDays"
      ),
      activePhase: expectString(
        weeklySummary.activePhase,
        "history response.weeklySummary.activePhase"
      )
    }
  };
}

function parseHistoryLog(payload: unknown, context: string): HistoryLog {
  const log = expectJsonObject(payload, context);
  return {
    date: expectString(log.date, `${context}.date`),
    status: expectString(log.status, `${context}.status`),
    updatedAt: expectString(log.updatedAt, `${context}.updatedAt`),
    energy: expectNullableNumber(log.energy, `${context}.energy`),
    productivity: expectNullableNumber(log.productivity, `${context}.productivity`),
    executionScore: expectNullableNumber(log.executionScore, `${context}.executionScore`),
    stateScore: expectNullableNumber(log.stateScore, `${context}.stateScore`),
    riskScore: expectNullableNumber(log.riskScore, `${context}.riskScore`)
  };
}

function expectNullableNumber(value: unknown, field: string): number | null {
  return value === null ? null : expectNumber(value, field);
}

function expectHistoryFilter(value: unknown, field: string): HistoryFilter {
  const historyFilter = HISTORY_FILTERS.find((filter) => filter === value);
  if (historyFilter) return historyFilter;
  throw new Error(`${field} has an unsupported value`);
}
