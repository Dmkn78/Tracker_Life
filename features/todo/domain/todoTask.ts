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
  date: string;
  objectiveId?: string | null;
  objectiveTitle?: string | null;
  importance: TodoImportance;
  productive: boolean;
  estimatedMinutes: number;
  completionPercent: number;
  status: TodoStatus;
};

export type TodoTaskDraft = {
  id?: string;
  title: string;
  date: string;
  objectiveId: string;
  importance: TodoImportance;
  productive: boolean;
  estimatedMinutes: number;
  completionPercent: number;
  status: TodoStatus;
};

export type ObjectiveOption = {
  id: string;
  title: string;
  horizon: string;
};
