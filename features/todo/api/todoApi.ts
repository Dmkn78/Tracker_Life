import {
  expectBoolean,
  expectJsonObject,
  expectNumber,
  expectOptionalNullableString,
  expectString,
  requestJson
} from "@/lib/http/apiClient";
import type { Tag } from "@/features/shared/domain/tagCompany";
import {
  TODO_IMPORTANCE_LEVELS,
  TODO_STATUSES,
  type ObjectiveOption,
  type TodoImportance,
  type TodoScope,
  type TodoStatus,
  type TodoTask,
  type TodoTaskWriteValues
} from "../domain/todoTask";

type ListTodoTasksInput = {
  date: string;
  scope: TodoScope;
  signal?: AbortSignal;
};

type ListTodoTasksRangeInput = {
  from: string;
  to: string;
  signal?: AbortSignal;
};

/** Wire shape for create/update: nullable fields (date, description, ...) can be
 * explicitly cleared with `null`, `undefined` simply omits the key. */
export type TaskWritePayload = Partial<TodoTaskWriteValues>;

type CreateTodoTaskItem = TaskWritePayload & { title: string };
type CreateTodoTasksInput = { items: CreateTodoTaskItem[] };
type UpdateTodoTaskInput = { id: string } & TaskWritePayload & { sortOrder?: number };

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

export function listTodoTasksInRange({
  from,
  to,
  signal
}: ListTodoTasksRangeInput): Promise<TodoTask[]> {
  const query = new URLSearchParams({ from, to });
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

export function reorderTodoTasks(ids: string[]): Promise<void> {
  return requestJson("/api/tasks/reorder", () => undefined, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });
}

export function deleteTodoTask(id: string): Promise<void> {
  return requestJson(`/api/tasks?id=${encodeURIComponent(id)}`, () => undefined, {
    method: "DELETE"
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
    description: expectOptionalNullableString(task.description, `${context}.description`) ?? null,
    date: expectOptionalNullableString(task.date, `${context}.date`) ?? null,
    startTime: expectOptionalNullableString(task.startTime, `${context}.startTime`) ?? null,
    endTime: expectOptionalNullableString(task.endTime, `${context}.endTime`) ?? null,
    objectiveId: expectOptionalNullableString(task.objectiveId, `${context}.objectiveId`),
    objectiveTitle: expectOptionalNullableString(task.objectiveTitle, `${context}.objectiveTitle`),
    companyId: expectOptionalNullableString(task.companyId, `${context}.companyId`),
    companyName: expectOptionalNullableString(task.companyName, `${context}.companyName`),
    companyColor: expectOptionalNullableString(task.companyColor, `${context}.companyColor`),
    tags: parseTags(task.tags, `${context}.tags`),
    importance: expectTodoImportance(task.importance, `${context}.importance`),
    productive: expectBoolean(task.productive, `${context}.productive`),
    estimatedMinutes: expectNumber(task.estimatedMinutes, `${context}.estimatedMinutes`),
    completionPercent: expectNumber(task.completionPercent, `${context}.completionPercent`),
    status: expectTodoStatus(task.status, `${context}.status`),
    notDoneReason: expectOptionalNullableString(task.notDoneReason, `${context}.notDoneReason`) ?? null,
    sortOrder: expectNumber(task.sortOrder, `${context}.sortOrder`)
  };
}

function parseTags(payload: unknown, context: string): Tag[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((tag, index) => {
    const record = expectJsonObject(tag, `${context}[${index}]`);
    return {
      id: expectString(record.id, `${context}[${index}].id`),
      name: expectString(record.name, `${context}[${index}].name`),
      color: expectString(record.color, `${context}[${index}].color`)
    };
  });
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
