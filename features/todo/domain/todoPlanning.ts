import type { ObjectiveOption, TodoTask } from "./todoTask";

export function monthRange(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  return { start: `${month}-01`, end: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10) };
}

export function monthWeeks(month: string): { start: string; end: string }[] {
  const range = monthRange(month);
  const first = new Date(`${range.start}T12:00:00Z`);
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
  const weeks: { start: string; end: string }[] = [];
  while (first.toISOString().slice(0, 10) <= range.end) {
    const end = new Date(first);
    end.setUTCDate(end.getUTCDate() + 6);
    weeks.push({ start: first.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    first.setUTCDate(first.getUTCDate() + 7);
  }
  return weeks;
}

export function taskProgress(task: TodoTask): number {
  return task.status === "done" ? 100 : task.completionPercent;
}

export function summarizeTasks(tasks: TodoTask[], today: string) {
  const active = tasks.filter((task) => task.status !== "cancelled");
  const open = active.filter((task) => taskProgress(task) < 100);
  return {
    total: active.length,
    completed: active.length - open.length,
    progress: active.length ? Math.round(active.reduce((sum, task) => sum + taskProgress(task), 0) / active.length) : 0,
    plannedMinutes: active.reduce((sum, task) => sum + task.estimatedMinutes, 0),
    remainingMinutes: Math.round(open.reduce((sum, task) => sum + task.estimatedMinutes * (1 - taskProgress(task) / 100), 0)),
    actualMinutes: tasks.reduce((sum, task) => sum + (task.workSessions ?? []).reduce((minutes, session) => minutes + (session.actualMinutes ?? 0), 0), 0),
    missingEstimates: open.filter((task) => !task.estimatedMinutes).length,
    scheduledEarlier: open.filter((task) => !!task.date && task.date < today).length,
    priorities: open.filter((task) => task.importance === "high").length,
    undated: open.filter((task) => !task.date).length
  };
}

export function groupTasksByObjective(tasks: TodoTask[], objectives: ObjectiveOption[], today: string) {
  const availableObjectives = [...objectives];
  for (const task of tasks) {
    if (task.objectiveId && !availableObjectives.some((objective) => objective.id === task.objectiveId)) {
      availableObjectives.push({ id: task.objectiveId, title: task.objectiveTitle ?? task.objectiveId, horizon: "" });
    }
  }
  const groups = [...availableObjectives.map((objective) => ({ id: objective.id, title: objective.title, color: objective.color, horizon: objective.horizon })), { id: "", title: "", color: undefined, horizon: "" }];
  return groups.map((group) => {
    const groupedTasks = tasks.filter((task) => (task.objectiveId ?? "") === group.id);
    return { ...group, tasks: groupedTasks, summary: summarizeTasks(groupedTasks, today) };
  });
}

export function taskSlot(date: string, startTime?: string): { date: string; startTime: string; endTime: string; estimatedMinutes: number } {
  if (!startTime) return { date, startTime: "", endTime: "", estimatedMinutes: 0 };
  const start = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
  const end = Math.min(1439, start + 60);
  return { date, startTime, endTime: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`, estimatedMinutes: end - start };
}
