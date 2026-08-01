import {
  expectBoolean,
  expectJsonObject,
  expectNumber,
  expectOptionalNullableString,
  expectString,
  requestJson
} from "@/lib/http/apiClient";
import {
  TODO_IMPORTANCE_LEVELS,
  TODO_STATUSES,
  type ObjectiveOption,
  type TodoImportance,
  type TodoScope,
  type TodoStatus,
  type TodoTask,
  type TodoTaskDraft
} from "../domain/todoTask";

type ListTodoTasksInput = {
  date: string;
  scope: TodoScope;
  signal?: AbortSignal;
};

type CreateTodoTasksInput = TodoTaskDraft & {
  titles: string[];
};

type UpdateTodoTaskInput = { id: string } & Partial<Omit<TodoTask, "id">>;

export function listTodoTasks({
  date,
  scope,
  signal
}: ListTodoTasksInput): Promise<TodoTask[]> {
  const query = new URLSearchParams({ scope, date });
  return requestJson(`/api/tasks?${query.toString()}`, parseTodoTasksResponse, {
    signal
  });
}

export function listObjectiveOptions(signal?: AbortSignal): Promise<ObjectiveOption[]> {
  return requestJson("/api/objectives", parseObjectiveOptionsResponse, { signal });
}

export function createTodoTasks(input: CreateTodoTasksInput): Promise<TodoTask[]> {
  return requestJson("/api/tasks", parseCreatedTodoTasksResponse, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function updateTodoTask(
  input: UpdateTodoTaskInput
): Promise<TodoTask> {
  return requestJson("/api/tasks", parseUpdatedTodoTaskResponse, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

function parseTodoTasksResponse(payload: unknown): TodoTask[] {
  const response = expectJsonObject(payload, "tasks response");
  return parseTodoTasks(response.tasks, "tasks response.tasks");
}

function parseCreatedTodoTasksResponse(payload: unknown): TodoTask[] {
  const response = expectJsonObject(payload, "created tasks response");
  return parseTodoTasks(response.tasks, "created tasks response.tasks");
}

function parseUpdatedTodoTaskResponse(payload: unknown): TodoTask {
  const response = expectJsonObject(payload, "updated task response");
  return parseTodoTask(response.task, "updated task response.task");
}

function parseObjectiveOptionsResponse(payload: unknown): ObjectiveOption[] {
  const response = expectJsonObject(payload, "objectives response");
  if (!Array.isArray(response.objectives)) {
    throw new Error("objectives response.objectives must be an array");
  }
  return response.objectives.map((objective, index) => {
    const context = `objectives response.objectives[${index}]`;
    const record = expectJsonObject(objective, context);
    return {
      id: expectString(record.id, `${context}.id`),
      title: expectString(record.title, `${context}.title`),
      horizon: expectString(record.horizon, `${context}.horizon`)
    };
  });
}

function parseTodoTasks(payload: unknown, context: string): TodoTask[] {
  if (!Array.isArray(payload)) throw new Error(`${context} must be an array`);
  return payload.map((task, index) => parseTodoTask(task, `${context}[${index}]`));
}

function parseTodoTask(payload: unknown, context: string): TodoTask {
  const task = expectJsonObject(payload, context);
  return {
    id: expectString(task.id, `${context}.id`),
    title: expectString(task.title, `${context}.title`),
    date: expectString(task.date, `${context}.date`),
    objectiveId: expectOptionalNullableString(task.objectiveId, `${context}.objectiveId`),
    objectiveTitle: expectOptionalNullableString(task.objectiveTitle, `${context}.objectiveTitle`),
    importance: expectTodoImportance(task.importance, `${context}.importance`),
    productive: expectBoolean(task.productive, `${context}.productive`),
    estimatedMinutes: expectNumber(task.estimatedMinutes, `${context}.estimatedMinutes`),
    completionPercent: expectNumber(task.completionPercent, `${context}.completionPercent`),
    status: expectTodoStatus(task.status, `${context}.status`)
  };
}

function expectTodoImportance(value: unknown, field: string): TodoImportance {
  if (typeof value === "string" && TODO_IMPORTANCE_LEVELS.some((level) => level === value)) {
    return value as TodoImportance;
  }
  throw new Error(`${field} must be a valid task importance`);
}

function expectTodoStatus(value: unknown, field: string): TodoStatus {
  if (typeof value === "string" && TODO_STATUSES.some((status) => status === value)) {
    return value as TodoStatus;
  }
  throw new Error(`${field} must be a valid task status`);
}
