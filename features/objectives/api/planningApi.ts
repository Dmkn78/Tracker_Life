import { expectBoolean, expectJsonObject, expectNullableString, expectNumber, expectString, expectStringArray, parseJsonArray, requestJson } from "@/lib/http/apiClient";
import { parseObjectiveTask, parseWeeklyPlanBlock } from "./objectivesApi";
import type { ObjectiveInsight, PlanningData, PlanningMutation } from "../domain/planning";

export function loadPlanning(month: string, signal?: AbortSignal): Promise<PlanningData> {
  return requestJson(`/api/objectives/planning?month=${encodeURIComponent(month)}`, parsePlanning, { signal });
}

export async function savePlanning(mutation: PlanningMutation): Promise<void> {
  await requestJson(`/api/objectives/planning/${mutation.path}`, (payload) => {
    const response = expectJsonObject(payload);
    if (!expectBoolean(response.ok, "ok")) throw new Error("Planning was not saved");
  }, { method: mutation.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(mutation.body) });
}

export async function savePlanningTask(payload: { objectiveId: string; title: string; estimatedMinutes: number } | { id: string; status: "done" | "planned"; completionPercent: number }): Promise<void> {
  await requestJson("/api/tasks", (result) => { expectJsonObject(result); }, {
    method: "id" in payload ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
}

function nullableNumber(value: unknown, context: string): number | null {
  return value === null ? null : expectNumber(value, context);
}

function parseInsight(payload: unknown, context: string): ObjectiveInsight {
  const source = expectJsonObject(payload, context);
  const network = expectJsonObject(source.network, `${context}.network`);
  return {
    objectiveId: expectString(source.objectiveId, context), objectiveIds: expectStringArray(source.objectiveIds, context), progressMode: expectString(source.progressMode, context),
    startDate: expectString(source.startDate, context), forecastDate: expectNullableString(source.forecastDate, context),
    ignoredUntil: expectNullableString(source.ignoredUntil, context),
    progress: expectNumber(source.progress, context), effortMinutes: expectNumber(source.effortMinutes, context),
    impact: expectNumber(source.impact, context), observationCount: expectNumber(source.observationCount, context),
    actualMinutes: expectNumber(source.actualMinutes, context), plannedMonthMinutes: expectNumber(source.plannedMonthMinutes, context),
    actualMonthMinutes: expectNumber(source.actualMonthMinutes, context), recoveryDays: expectNumber(source.recoveryDays, context),
    recoveryDailyMinutes: expectNumber(source.recoveryDailyMinutes, context),
    expectedProgress: nullableNumber(source.expectedProgress, context), gap: nullableNumber(source.gap, context),
    velocity: nullableNumber(source.velocity, context), momentum: nullableNumber(source.momentum, context),
    requiredVelocity: nullableNumber(source.requiredVelocity, context), slipDays: nullableNumber(source.slipDays, context),
    onTimeProbability: nullableNumber(source.onTimeProbability, context), health: nullableNumber(source.health, context),
    executionRate: nullableNumber(source.executionRate, context), recoveryMinutes: nullableNumber(source.recoveryMinutes, context),
    taskIds: expectStringArray(source.taskIds, context),
    history: parseJsonArray(source.history, context, (item, location) => {
      const point = expectJsonObject(item, location);
      return { date: expectString(point.date, location), progress: expectNumber(point.progress, location) };
    }),
    network: {
      totalMinutes: expectNumber(network.totalMinutes, context), missingEstimates: expectNumber(network.missingEstimates, context),
      tasks: parseJsonArray(network.tasks, context, (item, location) => {
        const task = expectJsonObject(item, location);
        return { id: expectString(task.id, location), title: expectString(task.title, location), predecessorIds: expectStringArray(task.predecessorIds, location), expectedMinutes: expectNumber(task.expectedMinutes, location), startMinutes: expectNumber(task.startMinutes, location), slackMinutes: expectNumber(task.slackMinutes, location), critical: expectBoolean(task.critical, location) };
      })
    }
  };
}

export function parsePlanning(payload: unknown): PlanningData {
  const source = expectJsonObject(payload, "planning");
  return {
    today: expectString(source.today, "today"), month: expectString(source.month, "month"),
    insights: parseJsonArray(source.insights, "insights", parseInsight),
    weeks: parseJsonArray(source.weeks, "weeks", (item, context) => {
      const week = expectJsonObject(item, context);
      return { start: expectString(week.start, context), end: expectString(week.end, context), label: expectString(week.label, context) };
    }),
    recommendations: parseJsonArray(source.recommendations, "recommendations", (item, context) => {
      const recommendation = expectJsonObject(item, context);
      return { objectiveId: expectString(recommendation.objectiveId, context), reason: expectString(recommendation.reason, context) };
    }),
    blocks: parseJsonArray(source.blocks, "blocks", (item, context) => {
      const block = expectJsonObject(item, context);
      return { ...parseWeeklyPlanBlock(item, context), recoveryAction: expectNullableString(block.recoveryAction, context), replacementId: expectNullableString(block.replacementId, context) };
    }),
    tasks: parseJsonArray(source.tasks, "tasks", (item, context) => {
      const task = expectJsonObject(item, context);
      return { ...parseObjectiveTask(item, context), optimisticMinutes: expectNumber(task.optimisticMinutes, context), likelyMinutes: expectNumber(task.likelyMinutes, context), pessimisticMinutes: expectNumber(task.pessimisticMinutes, context), predecessorIds: expectStringArray(task.predecessorIds, context) };
    })
  };
}
