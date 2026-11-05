import type { BoardDay, BoardTask } from "../../week/domain/weekBoard.ts";

export type BacklogGroup = { key: string; title: string | null; tasks: BoardTask[] };

const UNASSIGNED_GROUP_KEY = "unassigned";

/** Tasks to schedule, grouped by goal (goals in first-appearance order, tasks without goal last). */
export function groupBacklogByGoal(tasks: BoardTask[]): BacklogGroup[] {
  const groupsByKey = new Map<string, BacklogGroup>();
  for (const task of tasks) {
    const key = task.objectiveId ?? UNASSIGNED_GROUP_KEY;
    const group = groupsByKey.get(key) ?? { key, title: task.objectiveId ? task.objectiveTitle : null, tasks: [] };
    groupsByKey.set(key, { ...group, tasks: [...group.tasks, task] });
  }
  const groups = [...groupsByKey.values()];
  const orderedGroups = [...groups.filter((group) => group.key !== UNASSIGNED_GROUP_KEY), ...groups.filter((group) => group.key === UNASSIGNED_GROUP_KEY)];
  return orderedGroups;
}

/** Day chips offered by "Plan": today onwards; a fully past week (reviewing it) keeps all its days. */
export function selectPlannableDays(days: BoardDay[], todayKey: string): BoardDay[] {
  const upcomingDays = days.filter((day) => day.date >= todayKey);
  const plannableDays = upcomingDays.length ? upcomingDays : days;
  return plannableDays;
}
