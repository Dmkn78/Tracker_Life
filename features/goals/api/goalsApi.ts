import { expectBoolean, expectJsonObject, expectNullableString, expectNumber, expectString, parseJsonArray, requestJson } from "@/lib/http/apiClient";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/aiRequestTimeout";
import { createTodoTasks } from "@/features/todo/api/todoApi";
import { DEFAULT_GOAL_HORIZON, type Goal, type GoalTask, type ProposedStep } from "../domain/goal";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function fetchGoals(signal?: AbortSignal): Promise<Goal[]> {
  return requestJson("/api/goals", (payload) => parseJsonArray(expectJsonObject(payload, "goals").goals, "goals", parseGoal), { signal });
}

export function createGoal(title: string): Promise<void> {
  return requestJson("/api/objectives", () => undefined, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ title, horizon: DEFAULT_GOAL_HORIZON, status: "active" })
  });
}

export function renameGoal(id: string, title: string): Promise<void> {
  return requestJson("/api/objectives", () => undefined, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ id, title }) });
}

export function markGoalDone(id: string): Promise<void> {
  return requestJson("/api/objectives", () => undefined, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ id, status: "done" }) });
}

export function reopenGoal(id: string): Promise<void> {
  return requestJson("/api/objectives", () => undefined, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ id, status: "active" }) });
}

/** Archived, not erased: linked tasks are kept and simply detached (existing API behaviour). */
export function archiveGoal(id: string): Promise<void> {
  return requestJson(`/api/objectives?id=${encodeURIComponent(id)}`, () => undefined, { method: "DELETE" });
}

export async function addGoalSteps(goalId: string, steps: ProposedStep[]): Promise<void> {
  await createTodoTasks({ items: steps.map((step) => ({ title: step.title, description: step.detail, objectiveId: goalId, date: null })) });
}

export function proposeGoalSteps(goalId: string, signal?: AbortSignal): Promise<ProposedStep[]> {
  return requestJson("/api/insights/decompose", parseProposedSteps, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ objectiveId: goalId }), signal, timeoutMs: AI_REQUEST_TIMEOUT_MS
  });
}

function parseGoal(payload: unknown, context: string): Goal {
  const goal = expectJsonObject(payload, context);
  const parsedGoal: Goal = {
    id: expectString(goal.id, `${context}.id`),
    title: expectString(goal.title, `${context}.title`),
    summary: expectNullableString(goal.summary, `${context}.summary`),
    isDone: expectBoolean(goal.isDone, `${context}.isDone`),
    tasksDone: expectNumber(goal.tasksDone, `${context}.tasksDone`),
    tasksTotal: expectNumber(goal.tasksTotal, `${context}.tasksTotal`),
    openTasks: parseJsonArray(goal.openTasks, `${context}.openTasks`, parseGoalTask)
  };
  return parsedGoal;
}

function parseGoalTask(payload: unknown, context: string): GoalTask {
  const task = expectJsonObject(payload, context);
  const goalTask: GoalTask = {
    id: expectString(task.id, `${context}.id`),
    title: expectString(task.title, `${context}.title`),
    date: expectNullableString(task.date, `${context}.date`)
  };
  return goalTask;
}

function parseProposedSteps(payload: unknown): ProposedStep[] {
  const response = expectJsonObject(payload, "goal steps");
  const steps = parseJsonArray(response.steps, "goal steps.steps", (entry, context) => {
    const step = expectJsonObject(entry, context);
    return { title: expectString(step.title, `${context}.title`), detail: expectNullableString(step.detail, `${context}.detail`) };
  });
  return steps;
}
