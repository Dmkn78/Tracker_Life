import {
  expectBoolean,
  expectJsonObject,
  expectNumber,
  expectOptionalNullableString,
  expectString,
  parseJsonArray,
  requestJson
} from "@/lib/http/apiClient";
import { emptyTodoTaskFields, isTodoImportance, toTodoTaskWriteValues, type TodoTaskFields } from "../domain/todoTask";
import type { TodoTemplate } from "../domain/todoTemplate";

export function listTodoTemplates(signal?: AbortSignal): Promise<TodoTemplate[]> {
  return requestJson("/api/task-templates", (payload) => {
    const response = expectJsonObject(payload, "templates response");
    return parseJsonArray(response.templates, "templates", parseTemplate);
  }, { signal });
}

export function saveTodoTemplate(name: string, fields: TodoTaskFields): Promise<TodoTemplate> {
  return requestJson("/api/task-templates", (payload) => {
    const response = expectJsonObject(payload, "template response");
    return parseTemplate(response.template, "template");
  }, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, fields: toTodoTaskWriteValues(fields) })
  });
}

export function deleteTodoTemplate(id: string): Promise<void> {
  return requestJson(`/api/task-templates?id=${encodeURIComponent(id)}`, () => undefined, { method: "DELETE" });
}

function parseTemplate(payload: unknown, context: string): TodoTemplate {
  const template = expectJsonObject(payload, context);
  const fields = expectJsonObject(template.fields, `${context}.fields`);
  const importance = expectString(fields.importance, `${context}.importance`);
  if (!isTodoImportance(importance)) throw new Error("Invalid template importance");
  const description = expectOptionalNullableString(fields.description, `${context}.description`) ?? "";
  return {
    id: expectString(template.id, `${context}.id`),
    name: expectString(template.name, `${context}.name`),
    fields: {
      ...emptyTodoTaskFields(""),
      title: expectString(fields.title, `${context}.title`),
      isDay: expectBoolean(fields.isDay, `${context}.isDay`),
      description,
      descriptionChoice: "yes",
      startTime: expectOptionalNullableString(fields.startTime, `${context}.startTime`) ?? "",
      endTime: expectOptionalNullableString(fields.endTime, `${context}.endTime`) ?? "",
      objectiveId: expectOptionalNullableString(fields.objectiveId, `${context}.objectiveId`) ?? "",
      companyName: expectOptionalNullableString(fields.companyName, `${context}.companyName`) ?? "",
      tagNames: parseJsonArray(fields.tagNames, `${context}.tagNames`, expectString),
      productive: expectBoolean(fields.productive, `${context}.productive`),
      estimatedMinutes: expectNumber(fields.estimatedMinutes, `${context}.estimatedMinutes`),
      importance
    }
  };
}
