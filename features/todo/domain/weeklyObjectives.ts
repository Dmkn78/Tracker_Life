import type { ObjectiveOption, TodoTask } from "./todoTask";

export type WeeklyObjectiveRow = {
  objective: ObjectiveOption;
  tasks: TodoTask[];
  completedTasks: number;
  scheduledTasks: number;
  scheduledMinutes: number;
};

type WeeklyObjectivesInput = {
  objectives: ObjectiveOption[];
  tasks: TodoTask[];
  weekId: string;
  firstDate: string;
  lastDate: string;
  selectedObjectiveId: string;
};

export function buildWeeklyObjectiveRows({ objectives, tasks, weekId, firstDate, lastDate, selectedObjectiveId }: WeeklyObjectivesInput): WeeklyObjectiveRow[] {
  const activeTasks = tasks.filter((task) => task.status !== "cancelled");
  return objectives.flatMap((objective) => {
    const objectiveTasks = activeTasks.filter((task) => task.objectiveId === objective.id);
    const scheduledTasks = objectiveTasks.filter((task) => task.date && task.date >= firstDate && task.date <= lastDate);
    const belongsToWeek = objective.horizon === "week" && (
      objective.weekId === weekId || (!objective.weekId && Boolean(objective.targetDate && objective.targetDate >= firstDate && objective.targetDate <= lastDate))
    );
    if (!belongsToWeek && !scheduledTasks.length && objective.id !== selectedObjectiveId) return [];
    return [{
      objective,
      tasks: objectiveTasks,
      completedTasks: objectiveTasks.filter((task) => task.status === "done").length,
      scheduledTasks: scheduledTasks.length,
      scheduledMinutes: scheduledTasks.reduce((minutes, task) => minutes + scheduledWorkMinutes(task), 0)
    }];
  });
}

export function scheduledWorkMinutes(task: Pick<TodoTask, "startTime" | "endTime">): number {
  if (!task.startTime || !task.endTime) return 0;
  const startMinutes = Number(task.startTime.slice(0, 2)) * 60 + Number(task.startTime.slice(3, 5));
  const endMinutes = Number(task.endTime.slice(0, 2)) * 60 + Number(task.endTime.slice(3, 5));
  return Math.max(0, endMinutes - startMinutes);
}
