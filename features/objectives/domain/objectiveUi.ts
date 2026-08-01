import { toDateKey } from "@/lib/dates";
import type {
  ObjectiveHorizon,
  ObjectiveKind,
  ObjectivePriority,
  ObjectiveStatus,
  WeeklyPlanCategory
} from "./objective";

export type ObjectiveDraft = {
  id?: string;
  title: string;
  parentId: string;
  summary: string;
  nextAction: string;
  kind: ObjectiveKind;
  horizon: ObjectiveHorizon;
  status: ObjectiveStatus;
  priority: ObjectivePriority;
  targetDate: string;
  weekId: string;
  color: string;
  linkedTaskIds: string[];
};

export type WeeklyBlockDraft = {
  id?: string;
  title: string;
  objectiveId: string;
  category: WeeklyPlanCategory;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  flexible: boolean;
  note: string;
};

export const objectiveKinds = ["objective", "project", "milestone"] as const;
export const objectiveHorizons = ["year", "quarter", "month", "week"] as const;
export const objectiveStatuses = ["planned", "active", "on_track", "at_risk", "paused", "done"] as const;
export const objectivePriorities = ["low", "medium", "high", "critical"] as const;
export const weeklyPlanCategories = ["work", "study", "sport", "rest", "admin", "personal", "social", "travel"] as const;

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes === 0) return "0m";
  const days = Math.floor(minutes / (60 * 24));
  const afterDays = minutes % (60 * 24);
  const hours = Math.floor(afterDays / 60);
  const remainingMinutes = afterDays % 60;
  return [
    days ? `${days}d` : "",
    hours ? `${hours}h` : "",
    remainingMinutes ? `${remainingMinutes}m` : ""
  ].filter(Boolean).join(" ");
}

export function defaultObjectiveDraft(): ObjectiveDraft {
  return {
    title: "",
    parentId: "",
    summary: "",
    nextAction: "",
    kind: "objective",
    horizon: "week",
    status: "planned",
    priority: "medium",
    targetDate: toDateKey(),
    weekId: "",
    color: "#8da2fb",
    linkedTaskIds: [] as string[]
  };
}

export function defaultWeeklyBlockDraft(date = toDateKey()): WeeklyBlockDraft {
  return {
    title: "",
    objectiveId: "",
    category: "work",
    date,
    startTime: "",
    endTime: "",
    durationMinutes: 60,
    flexible: false,
    note: ""
  };
}
