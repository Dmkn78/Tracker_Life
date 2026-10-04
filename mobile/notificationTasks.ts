import type { TodoTask } from "../features/todo/domain/todoTask";

export type NotificationTaskSummary = { date: string; completed: number; total: number; titles: string[] };

export function summarizeNotificationTasks(tasks: (Pick<TodoTask, "date" | "status"> & Partial<Pick<TodoTask, "title">>)[], date: string): NotificationTaskSummary {
  const planned = tasks.filter(task => task.date === date && task.status !== "cancelled");
  return { date, completed: planned.filter(task => task.status === "done").length, total: planned.length, titles: planned.filter(task => task.status !== "done" && task.title).slice(0, 3).map(task => task.title!.replace(/\s+/g, " ").slice(0, 120)) };
}

export function notificationDestination(input: string): "create-todo" | "todo" | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "liferegime:" || url.hostname !== "todo" || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname === "/new") return "create-todo";
    return url.pathname === "" || url.pathname === "/" ? "todo" : null;
  } catch { return null; }
}
