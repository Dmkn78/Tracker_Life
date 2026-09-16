import { expectJsonObject, expectNullableString, expectNumber, expectString, parseJsonArray, requestJson } from "@/lib/http/apiClient";
import type { PerformanceData, PerformancePeriod } from "../domain/performance";

export function parsePerformanceData(payload: unknown): PerformanceData {
  const record = expectJsonObject(payload, "performance");
  const policy = expectJsonObject(record.rewardPolicy, "rewardPolicy");
  const number = (field: string): number => expectNumber(record[field], field);
  return {
    rewardPolicy: {
      hourlyCents: expectNumber(policy.hourlyCents, "rewardPolicy.hourlyCents"),
      taskCents: expectNumber(policy.taskCents, "rewardPolicy.taskCents"),
      priorityTaskCents: expectNumber(policy.priorityTaskCents, "rewardPolicy.priorityTaskCents"),
      milestoneCents: expectNumber(policy.milestoneCents, "rewardPolicy.milestoneCents"),
      objectiveCents: expectNumber(policy.objectiveCents, "rewardPolicy.objectiveCents"),
      projectCents: expectNumber(policy.projectCents, "rewardPolicy.projectCents"),
      deadlineBonusCents: expectNumber(policy.deadlineBonusCents, "rewardPolicy.deadlineBonusCents"),
      focusBonusCents: expectNumber(policy.focusBonusCents, "rewardPolicy.focusBonusCents"),
      streakBonusCents: expectNumber(policy.streakBonusCents, "rewardPolicy.streakBonusCents"),
    },
    today: expectString(record.today, "today"), profileName: expectString(record.profileName, "profileName"),
    index: number("index"), execution: record.execution === null ? null : number("execution"),
    focusScore: number("focusScore"), consistency: number("consistency"), streak: number("streak"),
    daily: parsePeriod(record.daily), week: parsePeriod(record.week), previousWeek: parsePeriod(record.previousWeek),
    month: parsePeriod(record.month), total: parsePeriod(record.total),
    targetMinutes: number("targetMinutes"), expectedMinutes: number("expectedMinutes"), gapMinutes: number("gapMinutes"),
    remainingMinutes: number("remainingMinutes"), requiredDailyMinutes: number("requiredDailyMinutes"),
    status: expectString(record.status, "status"), nextStatus: expectNullableString(record.nextStatus, "nextStatus"),
    nextCapitalCents: number("nextCapitalCents"), nextProductiveDays: number("nextProductiveDays"),
    statusProgress: number("statusProgress"), undatedCompletions: number("undatedCompletions"),
    history: parseJsonArray(record.history, "history", (entry) => {
      const row = expectJsonObject(entry);
      return { ...parsePeriod(row), start: expectString(row.start, "start"), targetMinutes: expectNumber(row.targetMinutes, "targetMinutes") };
    }),
    rewards: parseJsonArray(record.rewards, "rewards", (entry) => {
      const row = expectJsonObject(entry);
      return { id: expectString(row.id, "id"), date: expectString(row.date, "date"), title: expectString(row.title, "title"),
        reason: expectString(row.reason, "reason"), capitalCents: expectNumber(row.capitalCents, "capitalCents") };
    }),
    monthlyHistory: parseJsonArray(record.monthlyHistory, "monthlyHistory", (entry) => {
      const row = expectJsonObject(entry);
      return { ...parsePeriod(row), start: expectString(row.start, "start") };
    }),
    recentSessions: parseJsonArray(record.recentSessions, "recentSessions", (entry) => {
      const row = expectJsonObject(entry);
      return { id: expectString(row.id, "id"), date: expectString(row.date, "date"), title: expectString(row.title, "title"),
        actualMinutes: expectNumber(row.actualMinutes, "actualMinutes"), executionStatus: expectString(row.executionStatus, "executionStatus") };
    }),
    objectiveOptions: parseJsonArray(record.objectiveOptions, "objectiveOptions", (entry) => {
      const row = expectJsonObject(entry);
      return { id: expectString(row.id, "id"), title: expectString(row.title, "title") };
    })
  };
}

function parsePeriod(payload: unknown): PerformancePeriod {
  const period = expectJsonObject(payload, "period");
  return { minutes: expectNumber(period.minutes, "minutes"), focusMinutes: expectNumber(period.focusMinutes, "focusMinutes"),
    tasks: expectNumber(period.tasks, "tasks"), objectives: expectNumber(period.objectives, "objectives"),
    capitalCents: expectNumber(period.capitalCents, "capitalCents"), productiveDays: expectNumber(period.productiveDays, "productiveDays") };
}

export function loadPerformance(signal?: AbortSignal): Promise<PerformanceData> {
  return requestJson("/api/performance", parsePerformanceData, { signal, cache: "no-store" });
}

export async function savePerformance(path: "target" | "work" | "block", payload: object, signal?: AbortSignal): Promise<PerformanceData> {
  const result = await requestJson(`/api/performance/${path}`, parsePerformanceData, {
    method: path === "work" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal
  });
  window.dispatchEvent(new Event("performance-updated"));
  return result;
}
