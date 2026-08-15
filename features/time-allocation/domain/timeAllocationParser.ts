import type {
  TimeAllocationData,
  TimeAllocationMetrics,
  TimeAllocationRow
} from "./timeAllocation.ts";
import type { TimeAllocationPeriod } from "./allocationPeriod.ts";

export function parseTimeAllocationData(payload: unknown): TimeAllocationData {
  const data = expectObject(payload, "time allocation response");
  if (!Array.isArray(data.rows)) throw new Error("time allocation response.rows must be an array");
  return {
    date: expectString(data.date, "time allocation response.date"),
    period: parsePeriod(data.period),
    rangeStart: expectString(data.rangeStart, "time allocation response.rangeStart"),
    rangeEnd: expectString(data.rangeEnd, "time allocation response.rangeEnd"),
    weekId: expectString(data.weekId, "time allocation response.weekId"),
    dayBudgetMinutes: expectNumber(data.dayBudgetMinutes, "time allocation response.dayBudgetMinutes"),
    periodBudgetMinutes: expectNumber(data.periodBudgetMinutes, "time allocation response.periodBudgetMinutes"),
    maximumBudgetMinutes: expectNumber(data.maximumBudgetMinutes, "time allocation response.maximumBudgetMinutes"),
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

function parsePeriod(value: unknown): TimeAllocationPeriod {
  const period = expectString(value, "time allocation response.period");
  if (period !== "day" && period !== "week" && period !== "month") throw new Error("time allocation response.period is invalid");
  return period;
}

function parseRow(payload: unknown, context: string): TimeAllocationRow {
  const row = expectObject(payload, context);
  return {
    id: expectString(row.id, `${context}.id`), name: expectString(row.name, `${context}.name`), objective: expectString(row.objective, `${context}.objective`),
    targetWeight: expectNumber(row.targetWeight, `${context}.targetWeight`), actualWeight: expectNumber(row.actualWeight, `${context}.actualWeight`), weekWeight: expectNumber(row.weekWeight, `${context}.weekWeight`),
    plannedMinutes: expectNumber(row.plannedMinutes, `${context}.plannedMinutes`), autoPlannedMinutes: expectNumber(row.autoPlannedMinutes, `${context}.autoPlannedMinutes`),
    plannedMinutesStored: expectNumber(row.plannedMinutesStored, `${context}.plannedMinutesStored`), plannedMinutesManual: expectBoolean(row.plannedMinutesManual, `${context}.plannedMinutesManual`),
    actualMinutes: expectNumber(row.actualMinutes, `${context}.actualMinutes`), weekActualMinutes: expectNumber(row.weekActualMinutes, `${context}.weekActualMinutes`),
    expectedReturn: expectNumber(row.expectedReturn, `${context}.expectedReturn`), risk: expectNumber(row.risk, `${context}.risk`), beta: expectNumber(row.beta, `${context}.beta`),
    color: expectString(row.color, `${context}.color`), active: expectBoolean(row.active, `${context}.active`)
  };
}

function parseMetrics(payload: unknown): TimeAllocationMetrics {
  const metrics = expectObject(payload, "time allocation response.metrics");
  return {
    targetReturn: expectNumber(metrics.targetReturn, "metrics.targetReturn"), actualReturn: expectNumber(metrics.actualReturn, "metrics.actualReturn"),
    targetRisk: expectNumber(metrics.targetRisk, "metrics.targetRisk"), actualRisk: expectNumber(metrics.actualRisk, "metrics.actualRisk"),
    beta: expectNumber(metrics.beta, "metrics.beta"), capmExpectedReturn: expectNumber(metrics.capmExpectedReturn, "metrics.capmExpectedReturn"),
    sharpeLike: expectNumber(metrics.sharpeLike, "metrics.sharpeLike")
  };
}

function expectObject(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function expectString(value: unknown, context: string): string {
  if (typeof value !== "string") throw new Error(`${context} must be a string`);
  return value;
}

function expectNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${context} must be a finite number`);
  return value;
}

function expectBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${context} must be a boolean`);
  return value;
}
