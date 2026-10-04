import type { TodoTaskFields } from "./todoTask";

export type TodoTemplate = {
  id: string;
  name: string;
  fields: TodoTaskFields;
};

export function applyTodoTemplate(template: TodoTemplate, current: TodoTaskFields): TodoTaskFields {
  return {
    ...template.fields,
    tagNames: [...template.fields.tagNames],
    date: current.date,
    completionPercent: 0,
    status: "planned",
    notDoneReason: ""
  };
}
