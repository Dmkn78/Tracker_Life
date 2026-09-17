import type { TodoTask } from "./todoTask";

const DEFAULT_SLOT_MINUTES = 60;
const LAST_MINUTE_OF_DAY = 1439;
type PlannableTask = Pick<TodoTask, "startTime" | "endTime" | "estimatedMinutes">;

export function taskPlanDuration(task: PlannableTask): number {
  const start = clockMinutes(task.startTime);
  const end = clockMinutes(task.endTime);
  if (start !== null && end !== null && end > start) return end - start;
  return task.estimatedMinutes > 0 ? task.estimatedMinutes : DEFAULT_SLOT_MINUTES;
}

export function planFunnelTask(task: PlannableTask, date: string, startTime: string | null): Pick<TodoTask, "date" | "startTime" | "endTime"> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choisis une date valide.");
  if (startTime === null) return { date, startTime: null, endTime: null };
  const start = clockMinutes(startTime);
  if (start === null || start >= LAST_MINUTE_OF_DAY) throw new Error("Choisis une heure valide avant 23 h 59.");
  const end = Math.min(LAST_MINUTE_OF_DAY, start + taskPlanDuration(task));
  const endTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return { date, startTime, endTime };
}

function clockMinutes(time: string | null): number | null {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
