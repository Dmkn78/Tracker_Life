export type BoardTaskStatus = "planned" | "in_progress" | "done" | "not_done" | "postponed" | "cancelled";

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  status: BoardTaskStatus;
  objectiveId: string | null;
  objectiveTitle: string | null;
};

export type BoardDeadline = {
  id: string;
  title: string;
  kind: string;
  kindLabel: string;
  time: string | null;
  courseName: string | null;
  courseColor: string | null;
};

export type BoardDay = { date: string; tasks: BoardTask[]; recap: string | null; deadlines: BoardDeadline[] };

export type WeekSummary = { planned: number; done: number; dropped: number; open: number; completionRate: number };

export type WeekBoard = {
  weekId: string;
  previousWeekId: string;
  nextWeekId: string;
  today: string;
  days: BoardDay[];
  inbox: BoardTask[];
  recap: string | null;
  summary: WeekSummary;
};

/** Where a task can be dropped: a day of the displayed week, or the undated inbox. */
export type TaskDestination = { kind: "day"; date: string } | { kind: "inbox" };

export const BOARD_TASK_STATUSES: readonly BoardTaskStatus[] = ["planned", "in_progress", "done", "not_done", "postponed", "cancelled"];
const DROPPED_STATUSES: readonly BoardTaskStatus[] = ["not_done", "cancelled"];

export function isDoneStatus(status: BoardTaskStatus): boolean {
  return status === "done";
}

export function isDroppedStatus(status: BoardTaskStatus): boolean {
  return DROPPED_STATUSES.includes(status);
}

/** Checkbox semantics: an unfinished task becomes done, a done or dropped task reopens. */
export function nextCheckboxStatus(status: BoardTaskStatus): BoardTaskStatus {
  const nextStatus: BoardTaskStatus = status === "done" || isDroppedStatus(status) ? "planned" : "done";
  return nextStatus;
}

export function destinationDate(destination: TaskDestination): string | null {
  const date = destination.kind === "day" ? destination.date : null;
  return date;
}

export function shiftDestination(board: WeekBoard, task: BoardTask, dayOffset: number): TaskDestination | null {
  const dayIndex = board.days.findIndex((day) => day.date === task.date);
  if (dayIndex === -1) return null;
  const targetDay = board.days[dayIndex + dayOffset];
  const destination: TaskDestination | null = targetDay ? { kind: "day", date: targetDay.date } : null;
  return destination;
}

/** Optimistic move, so the task jumps immediately while the server confirms. */
export function moveTaskOnBoard(board: WeekBoard, taskId: string, destination: TaskDestination): WeekBoard {
  const movingTask = [...board.inbox, ...board.days.flatMap((day) => day.tasks)].find((task) => task.id === taskId);
  if (!movingTask) return board;
  const movedTask: BoardTask = { ...movingTask, date: destinationDate(destination) };
  const days = board.days.map((day) => {
    const remainingTasks = day.tasks.filter((task) => task.id !== taskId);
    const isTarget = destination.kind === "day" && destination.date === day.date;
    return { ...day, tasks: isTarget ? [...remainingTasks, movedTask] : remainingTasks };
  });
  const remainingInbox = board.inbox.filter((task) => task.id !== taskId);
  const inbox = destination.kind === "inbox" ? [...remainingInbox, movedTask] : remainingInbox;
  const movedBoard: WeekBoard = { ...board, days, inbox, summary: summarizeDays(days) };
  return movedBoard;
}

export function updateTaskOnBoard(board: WeekBoard, taskId: string, change: Partial<BoardTask>): WeekBoard {
  const applyChange = (task: BoardTask): BoardTask => (task.id === taskId ? { ...task, ...change } : task);
  const days = board.days.map((day) => ({ ...day, tasks: day.tasks.map(applyChange) }));
  const updatedBoard: WeekBoard = { ...board, days, inbox: board.inbox.map(applyChange), summary: summarizeDays(days) };
  return updatedBoard;
}

export function removeTaskFromBoard(board: WeekBoard, taskId: string): WeekBoard {
  const days = board.days.map((day) => ({ ...day, tasks: day.tasks.filter((task) => task.id !== taskId) }));
  const reducedBoard: WeekBoard = { ...board, days, inbox: board.inbox.filter((task) => task.id !== taskId), summary: summarizeDays(days) };
  return reducedBoard;
}

export function summarizeDays(days: BoardDay[]): WeekSummary {
  const statuses = days.flatMap((day) => day.tasks.map((task) => task.status));
  const done = statuses.filter(isDoneStatus).length;
  const dropped = statuses.filter(isDroppedStatus).length;
  const summary: WeekSummary = {
    planned: statuses.length,
    done,
    dropped,
    open: statuses.length - done - dropped,
    completionRate: statuses.length ? Math.round((done / statuses.length) * 1000) / 1000 : 0
  };
  return summary;
}

/** Default day for the main quick-add field: today when visible, otherwise the week's Monday. */
export function defaultCaptureDate(board: WeekBoard): string {
  const isTodayVisible = board.days.some((day) => day.date === board.today);
  const captureDate = isTodayVisible ? board.today : board.days[0]?.date ?? board.today;
  return captureDate;
}
