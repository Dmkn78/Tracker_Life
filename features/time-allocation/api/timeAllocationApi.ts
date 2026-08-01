import {
  expectBoolean,
  expectJsonObject,
  expectNumber,
  expectString,
  requestJson
} from "@/lib/http/apiClient";
import type {
  TimeAllocationData,
  TimeAllocationDraft,
  TimeAllocationMetrics,
  TimeAllocationRow
} from "../domain/timeAllocation";

export function loadTimeAllocation(
  date: string,
  signal?: AbortSignal
): Promise<TimeAllocationData> {
  return requestJson(
    `/api/time-allocation?date=${encodeURIComponent(date)}`,
    parseTimeAllocationData,
    { signal }
  );
}

export function saveDayBudget(
  date: string,
  dayBudgetMinutes: number
): Promise<TimeAllocationData> {
  return mutateTimeAllocation({ kind: "day_budget", date, dayBudgetMinutes });
}

export function saveTimeAllocationPortfolio(
  date: string,
  draft: TimeAllocationDraft
): Promise<TimeAllocationData> {
  return mutateTimeAllocation({
    kind: "portfolio",
    date,
    id: draft.id,
    name: draft.name,
    objective: draft.objective,
    targetWeight: draft.targetWeight,
    plannedMinutes: draft.plannedMinutesManual ? draft.plannedMinutes : 0,
    plannedMinutesManual: draft.plannedMinutesManual,
    actualMinutes: draft.actualMinutes,
    color: draft.color
  });
}

export function archiveTimeAllocationCategory(
  id: string,
  date: string
): Promise<TimeAllocationData> {
  const query = new URLSearchParams({ id, date });
  return requestJson(
    `/api/time-allocation?${query.toString()}`,
    parseTimeAllocationData,
    { method: "DELETE" }
  );
}

function mutateTimeAllocation(payload: Record<string, unknown>): Promise<TimeAllocationData> {
  return requestJson("/api/time-allocation", parseTimeAllocationData, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function parseTimeAllocationData(payload: unknown): TimeAllocationData {
  const data = expectJsonObject(payload, "time allocation response");
  if (!Array.isArray(data.rows)) throw new Error("time allocation response.rows must be an array");
  return {
    date: expectString(data.date, "time allocation response.date"),
    weekId: expectString(data.weekId, "time allocation response.weekId"),
    dayBudgetMinutes: expectNumber(data.dayBudgetMinutes, "time allocation response.dayBudgetMinutes"),
    targetWeightTotal: expectNumber(data.targetWeightTotal, "time allocation response.targetWeightTotal"),
    plannedMinutesTotal: expectNumber(data.plannedMinutesTotal, "time allocation response.plannedMinutesTotal"),
    plannedMinutesAutoTotal: expectNumber(data.plannedMinutesAutoTotal, "time allocation response.plannedMinutesAutoTotal"),
    actualMinutesTotal: expectNumber(data.actualMinutesTotal, "time allocation response.actualMinutesTotal"),
    weekActualMinutesTotal: expectNumber(data.weekActualMinutesTotal, "time allocation response.weekActualMinutesTotal"),
    remainingBudgetMinutes: expectNumber(data.remainingBudgetMinutes, "time allocation response.remainingBudgetMinutes"),
    overBudgetMinutes: expectNumber(data.overBudgetMinutes, "time allocation response.overBudgetMinutes"),
    hasManualPlanOverrides: expectBoolean(data.hasManualPlanOverrides, "time allocation response.hasManualPlanOverrides"),
    rows: data.rows.map((row, index) => parseRow(row, `time allocation response.rows[${index}]`)),
    metrics: parseMetrics(data.metrics)
  };
}

function parseRow(payload: unknown, context: string): TimeAllocationRow {
  const row = expectJsonObject(payload, context);
  return {
    id: expectString(row.id, `${context}.id`),
    name: expectString(row.name, `${context}.name`),
    objective: expectString(row.objective, `${context}.objective`),
    targetWeight: expectNumber(row.targetWeight, `${context}.targetWeight`),
    actualWeight: expectNumber(row.actualWeight, `${context}.actualWeight`),
    weekWeight: expectNumber(row.weekWeight, `${context}.weekWeight`),
    plannedMinutes: expectNumber(row.plannedMinutes, `${context}.plannedMinutes`),
    autoPlannedMinutes: expectNumber(row.autoPlannedMinutes, `${context}.autoPlannedMinutes`),
    plannedMinutesStored: expectNumber(row.plannedMinutesStored, `${context}.plannedMinutesStored`),
    plannedMinutesManual: expectBoolean(row.plannedMinutesManual, `${context}.plannedMinutesManual`),
    actualMinutes: expectNumber(row.actualMinutes, `${context}.actualMinutes`),
    weekActualMinutes: expectNumber(row.weekActualMinutes, `${context}.weekActualMinutes`),
    expectedReturn: expectNumber(row.expectedReturn, `${context}.expectedReturn`),
    risk: expectNumber(row.risk, `${context}.risk`),
    beta: expectNumber(row.beta, `${context}.beta`),
    color: expectString(row.color, `${context}.color`),
    active: expectBoolean(row.active, `${context}.active`)
  };
}

function parseMetrics(payload: unknown): TimeAllocationMetrics {
  const metrics = expectJsonObject(payload, "time allocation response.metrics");
  return {
    targetReturn: expectNumber(metrics.targetReturn, "metrics.targetReturn"),
    actualReturn: expectNumber(metrics.actualReturn, "metrics.actualReturn"),
    targetRisk: expectNumber(metrics.targetRisk, "metrics.targetRisk"),
    actualRisk: expectNumber(metrics.actualRisk, "metrics.actualRisk"),
    beta: expectNumber(metrics.beta, "metrics.beta"),
    capmExpectedReturn: expectNumber(metrics.capmExpectedReturn, "metrics.capmExpectedReturn"),
    sharpeLike: expectNumber(metrics.sharpeLike, "metrics.sharpeLike")
  };
}
