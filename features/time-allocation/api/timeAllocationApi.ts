import {
  expectBoolean,
  expectJsonObject,
  expectNumber,
  expectString,
  requestJson
} from "@/lib/http/apiClient";
import type {
  TaskTimeBreakdown,
  TaskTimeBreakdownEntry,
  TaskTimeBreakdownPeriod,
  TimeAllocationData,
  TimeAllocationDraft,
  CalendarAllocationPlan
} from "../domain/timeAllocation";
import type { TimeAllocationPeriod } from "../domain/allocationPeriod";
export { parseTimeAllocationData } from "../domain/timeAllocationParser";
import { parseTimeAllocationData } from "../domain/timeAllocationParser";

export function loadTimeAllocation(
  period: TimeAllocationPeriod,
  date: string,
  signal?: AbortSignal
): Promise<TimeAllocationData> {
  return requestJson(
    `/api/time-allocation?period=${period}&date=${encodeURIComponent(date)}`,
    parseTimeAllocationData,
    { signal }
  );
}

export function saveTimeAllocationBudget(
  period: TimeAllocationPeriod,
  date: string,
  budgetMinutes: number
): Promise<TimeAllocationData> {
  return mutateTimeAllocation({
    kind: period === "day" ? "day_budget" : "period_budget",
    period,
    date,
    ...(period === "day" ? { dayBudgetMinutes: budgetMinutes } : { periodBudgetMinutes: budgetMinutes })
  });
}

export function saveTimeAllocationPortfolio(
  period: TimeAllocationPeriod,
  date: string,
  draft: TimeAllocationDraft
): Promise<TimeAllocationData> {
  return mutateTimeAllocation({
    kind: "portfolio",
    period,
    date,
    id: draft.id,
    name: draft.name,
    objective: draft.objective,
    targetWeight: draft.targetWeight,
    plannedMinutes: draft.plannedMinutes,
    plannedMinutesManual: draft.plannedMinutesManual,
    ...(period === "day" ? { actualMinutes: draft.actualMinutes } : {}),
    color: draft.color
  });
}

export function archiveTimeAllocationCategory(
  id: string,
  period: TimeAllocationPeriod,
  date: string
): Promise<TimeAllocationData> {
  const query = new URLSearchParams({ id, period, date });
  return requestJson(
    `/api/time-allocation?${query.toString()}`,
    parseTimeAllocationData,
    { method: "DELETE" }
  );
}

export function loadCalendarAllocationPlans(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<CalendarAllocationPlan[]> {
  const query = new URLSearchParams({ from, to });
  return requestJson(`/api/time-allocation/calendar?${query.toString()}`, (payload) => {
    const data = expectJsonObject(payload, "calendar allocation response");
    if (!Array.isArray(data.plans)) throw new Error("calendar allocation response.plans must be an array");
    return data.plans.map((value, index) => {
      const plan = expectJsonObject(value, `calendar allocation response.plans[${index}]`);
      const period = expectString(plan.period, `calendar allocation response.plans[${index}].period`);
      if (period !== "week" && period !== "month") throw new Error("calendar allocation plan period is invalid");
      return {
        id: expectString(plan.id, `calendar allocation response.plans[${index}].id`),
        categoryId: expectString(plan.categoryId, `calendar allocation response.plans[${index}].categoryId`),
        title: expectString(plan.title, `calendar allocation response.plans[${index}].title`),
        color: expectString(plan.color, `calendar allocation response.plans[${index}].color`),
        period,
        startDate: expectString(plan.startDate, `calendar allocation response.plans[${index}].startDate`),
        endDate: expectString(plan.endDate, `calendar allocation response.plans[${index}].endDate`),
        endExclusive: expectString(plan.endExclusive, `calendar allocation response.plans[${index}].endExclusive`),
        plannedMinutes: expectNumber(plan.plannedMinutes, `calendar allocation response.plans[${index}].plannedMinutes`)
      };
    });
  }, { signal });
}

export function loadTaskTimeBreakdown(
  period: TaskTimeBreakdownPeriod,
  date: string,
  signal?: AbortSignal
): Promise<TaskTimeBreakdown> {
  const query = new URLSearchParams({ period, date });
  return requestJson(
    `/api/time-allocation/tasks?${query.toString()}`,
    parseTaskTimeBreakdown,
    { signal }
  );
}

function parseTaskTimeBreakdown(payload: unknown): TaskTimeBreakdown {
  const data = expectJsonObject(payload, "task time breakdown response");
  const period = expectString(data.period, "task time breakdown response.period");
  if (period !== "week" && period !== "month") {
    throw new Error("task time breakdown response.period must be 'week' or 'month'");
  }
  if (!Array.isArray(data.byCompany)) throw new Error("task time breakdown response.byCompany must be an array");
  if (!Array.isArray(data.byTag)) throw new Error("task time breakdown response.byTag must be an array");
  return {
    period,
    rangeStart: expectString(data.rangeStart, "task time breakdown response.rangeStart"),
    rangeEnd: expectString(data.rangeEnd, "task time breakdown response.rangeEnd"),
    totalMinutes: expectNumber(data.totalMinutes, "task time breakdown response.totalMinutes"),
    taskCount: expectNumber(data.taskCount, "task time breakdown response.taskCount"),
    byCompany: data.byCompany.map((entry, index) =>
      parseBreakdownEntry(entry, "companyId", `task time breakdown response.byCompany[${index}]`)
    ),
    noCompanyMinutes: expectNumber(data.noCompanyMinutes, "task time breakdown response.noCompanyMinutes"),
    byTag: data.byTag.map((entry, index) =>
      parseBreakdownEntry(entry, "tagId", `task time breakdown response.byTag[${index}]`)
    ),
    untaggedMinutes: expectNumber(data.untaggedMinutes, "task time breakdown response.untaggedMinutes")
  };
}

function parseBreakdownEntry(payload: unknown, idField: "companyId" | "tagId", context: string): TaskTimeBreakdownEntry {
  const entry = expectJsonObject(payload, context);
  return {
    id: expectString(entry[idField], `${context}.${idField}`),
    name: expectString(entry.name, `${context}.name`),
    color: expectString(entry.color, `${context}.color`),
    minutes: expectNumber(entry.minutes, `${context}.minutes`)
  };
}

function mutateTimeAllocation(payload: Record<string, unknown>): Promise<TimeAllocationData> {
  return requestJson("/api/time-allocation", parseTimeAllocationData, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
