import type { Tag } from "@/features/shared/domain/tagCompany";

export const TODO_IMPORTANCE_LEVELS = ["low", "medium", "high"] as const;
export const TODO_STATUSES = [
  "planned",
  "in_progress",
  "done",
  "postponed",
  "cancelled"
] as const;

export type TodoImportance = (typeof TODO_IMPORTANCE_LEVELS)[number];
export type TodoStatus = (typeof TODO_STATUSES)[number];
export type TodoScope = "today" | "tomorrow" | "all";

export type TodoTask = {
  id: string;
  title: string;
  description: string | null;
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
  sortOrder: number;
};

/** One task's editable fields, shared by the single-task form and each row of the multi-task form. */
export type TodoTaskFields = {
  title: string;
  description: string;
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
};

export type TodoTaskDraft = TodoTaskFields & { id?: string };

/** A row in the multi-task creation form: fields plus a per-row inclusion checkbox. */
export type TodoTaskRow = TodoTaskFields & { key: string; enabled: boolean };

export type ObjectiveOption = {
  id: string;
  title: string;
  horizon: string;
};

export function emptyTodoTaskFields(date: string): TodoTaskFields {
  return {
    title: "",
    description: "",
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
    status: "planned"
  };
}
