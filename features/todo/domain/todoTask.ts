import type { Tag } from "@/features/shared/domain/tagCompany";

export const TODO_IMPORTANCE_LEVELS = ["low", "medium", "high"] as const;
export const TODO_STATUSES = [
  "planned",
  "in_progress",
  "done",
  "not_done",
  "postponed",
  "cancelled"
] as const;

export type TodoImportance = (typeof TODO_IMPORTANCE_LEVELS)[number];
export type TodoStatus = (typeof TODO_STATUSES)[number];
export type TodoScope = "today" | "tomorrow" | "week" | "month" | "all";
export type TodoDescriptionChoice = "yes" | "no";

export type TodoTask = {
  workSessions?: { id: string; date: string; actualMinutes: number | null; executionStatus: string }[];
  id: string;
  title: string;
  description: string | null;
  isDay?: boolean;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  objectiveId?: string | null;
  objectiveTitle?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  companyColor?: string | null;
  tags: Tag[];
  importance: TodoImportance;
  productive: boolean;
  estimatedMinutes: number;
  completionPercent: number;
  status: TodoStatus;
  notDoneReason: string | null;
  sortOrder: number;
};

/** One task's editable fields, shared by the single-task form and each row of the multi-task form. */
export type TodoTaskFields = {
  title: string;
  isDay: boolean;
  description: string;
  descriptionChoice: TodoDescriptionChoice;
  date: string;
  startTime: string;
  endTime: string;
  objectiveId: string;
  companyName: string;
  tagNames: string[];
  importance: TodoImportance;
  productive: boolean;
  estimatedMinutes: number;
  completionPercent: number;
  status: TodoStatus;
  notDoneReason: string;
};

export type TodoTaskDraft = TodoTaskFields & { id?: string };

/** A row in the multi-task creation form: fields plus a per-row inclusion checkbox. */
export type TodoTaskRow = TodoTaskFields & { key: string; enabled: boolean };

export type ObjectiveOption = {
  id: string;
  title: string;
  horizon: string;
  color?: string;
  weekId?: string | null;
  targetDate?: string | null;
};

export type TodoTaskWriteValues = {
  title: string;
  isDay: boolean;
  description: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  objectiveId: string | null;
  companyName: string | null;
  tagNames: string[];
  importance: TodoImportance;
  productive: boolean;
  estimatedMinutes: number;
  completionPercent: number;
  status: TodoStatus;
  notDoneReason: string | null;
};

export function emptyTodoTaskFields(date: string): TodoTaskFields {
  return {
    title: "",
    isDay: false,
    description: "",
    descriptionChoice: "yes",
    date,
    startTime: "",
    endTime: "",
    objectiveId: "",
    companyName: "",
    tagNames: [],
    importance: "medium",
    productive: true,
    estimatedMinutes: 0,
    completionPercent: 0,
    status: "planned",
    notDoneReason: ""
  };
}

export function isTodoImportance(value: string): value is TodoImportance {
  return TODO_IMPORTANCE_LEVELS.some((importance) => importance === value);
}

export function isTodoStatus(value: string): value is TodoStatus {
  return TODO_STATUSES.some((status) => status === value);
}

export function todoTaskFieldsFromTask(task: TodoTask): TodoTaskFields {
  return {
    title: task.title,
    isDay: task.isDay ?? false,
    description: task.description ?? "",
    descriptionChoice: task.description ? "yes" : "no",
    date: task.date ?? "",
    startTime: task.startTime ?? "",
    endTime: task.endTime ?? "",
    objectiveId: task.objectiveId ?? "",
    companyName: task.companyName ?? "",
    tagNames: task.tags.map((tag) => tag.name),
    importance: task.importance,
    productive: task.productive,
    estimatedMinutes: task.estimatedMinutes,
    completionPercent: task.completionPercent,
    status: task.status,
    notDoneReason: task.status === "not_done" ? task.notDoneReason ?? "" : ""
  };
}

export function setTodoTaskImportance(
  fields: TodoTaskFields,
  importance: TodoImportance
): TodoTaskFields {
  return { ...fields, importance };
}

export function setTodoTaskStatus(fields: TodoTaskFields, status: TodoStatus): TodoTaskFields {
  return {
    ...fields,
    status,
    completionPercent: completionPercentForTodoStatus(fields.completionPercent, status),
    notDoneReason: status === "not_done" ? fields.notDoneReason : ""
  };
}

export function completionPercentForTodoStatus(
  currentCompletionPercent: number,
  status: TodoStatus
): number {
  if (status === "done") return 100;
  return currentCompletionPercent >= 100 ? 0 : currentCompletionPercent;
}

export function setTodoTaskProgress(
  fields: TodoTaskFields,
  completionPercent: number
): TodoTaskFields {
  const status: TodoStatus = completionPercent === 100
    ? "done"
    : completionPercent > 0
      ? "in_progress"
      : "planned";
  return { ...fields, completionPercent, status, notDoneReason: "" };
}

export function toTodoTaskWriteValues(fields: TodoTaskFields): TodoTaskWriteValues {
  return {
    title: fields.isDay ? "Journée" : fields.title.trim(),
    isDay: fields.isDay,
    description: fields.descriptionChoice === "yes" ? fields.description.trim() || null : null,
    date: fields.date || null,
    startTime: fields.startTime || null,
    endTime: fields.endTime || null,
    objectiveId: fields.objectiveId || null,
    companyName: fields.companyName.trim() || null,
    tagNames: fields.tagNames,
    importance: fields.importance,
    productive: fields.productive,
    estimatedMinutes: fields.estimatedMinutes,
    completionPercent: fields.completionPercent,
    status: fields.status,
    notDoneReason: fields.status === "not_done" ? fields.notDoneReason.trim() || null : null
  };
}

export function hasTodoTaskContent(fields: TodoTaskFields): boolean {
  return fields.isDay || Boolean(fields.title.trim() || (fields.descriptionChoice === "yes" && fields.description.trim()));
}
