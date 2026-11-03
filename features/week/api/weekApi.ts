import { expectJsonObject, expectNullableString, expectNumber, expectString, parseJsonArray, requestJson } from "@/lib/http/apiClient";
import { BOARD_TASK_STATUSES, type BoardDay, type BoardTask, type BoardTaskStatus, type WeekBoard, type WeekSummary } from "../domain/weekBoard";

const JSON_HEADERS = { "Content-Type": "application/json" };

export type RecapTarget = { kind: "day"; date: string } | { kind: "week"; weekId: string };

export function fetchWeekBoard(weekId: string | null, signal?: AbortSignal): Promise<WeekBoard> {
  const query = weekId ? `?weekId=${encodeURIComponent(weekId)}` : "";
  return requestJson(`/api/week${query}`, parseWeekBoard, { signal });
}

export function saveRecap(target: RecapTarget, text: string): Promise<void> {
  const body = target.kind === "day" ? { date: target.date, text } : { weekId: target.weekId, text };
  return requestJson("/api/week/recap", () => undefined, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(body) });
}

export function parseWeekBoard(payload: unknown): WeekBoard {
  const board = expectJsonObject(payload, "week");
  const weekBoard: WeekBoard = {
    weekId: expectString(board.weekId, "week.weekId"),
    previousWeekId: expectString(board.previousWeekId, "week.previousWeekId"),
    nextWeekId: expectString(board.nextWeekId, "week.nextWeekId"),
    today: expectString(board.today, "week.today"),
    days: parseJsonArray(board.days, "week.days", parseBoardDay),
    inbox: parseJsonArray(board.inbox, "week.inbox", parseBoardTask),
    recap: expectNullableString(board.recap, "week.recap"),
    summary: parseSummary(board.summary)
  };
  return weekBoard;
}

function parseBoardDay(payload: unknown, context: string): BoardDay {
  const day = expectJsonObject(payload, context);
  const boardDay: BoardDay = {
    date: expectString(day.date, `${context}.date`),
    tasks: parseJsonArray(day.tasks, `${context}.tasks`, parseBoardTask),
    recap: expectNullableString(day.recap, `${context}.recap`)
  };
  return boardDay;
}

function parseBoardTask(payload: unknown, context: string): BoardTask {
  const task = expectJsonObject(payload, context);
  const boardTask: BoardTask = {
    id: expectString(task.id, `${context}.id`),
    title: expectString(task.title, `${context}.title`),
    description: expectNullableString(task.description, `${context}.description`),
    date: expectNullableString(task.date, `${context}.date`),
    status: parseStatus(task.status, `${context}.status`),
    objectiveId: expectNullableString(task.objectiveId, `${context}.objectiveId`),
    objectiveTitle: expectNullableString(task.objectiveTitle, `${context}.objectiveTitle`)
  };
  return boardTask;
}

function parseSummary(payload: unknown): WeekSummary {
  const summary = expectJsonObject(payload, "week.summary");
  const weekSummary: WeekSummary = {
    planned: expectNumber(summary.planned, "week.summary.planned"),
    done: expectNumber(summary.done, "week.summary.done"),
    dropped: expectNumber(summary.dropped, "week.summary.dropped"),
    open: expectNumber(summary.open, "week.summary.open"),
    completionRate: expectNumber(summary.completionRate, "week.summary.completionRate")
  };
  return weekSummary;
}

function parseStatus(value: unknown, field: string): BoardTaskStatus {
  const status = expectString(value, field);
  if (!BOARD_TASK_STATUSES.includes(status as BoardTaskStatus)) throw new Error(`${field} is not a task status`);
  return status as BoardTaskStatus;
}
