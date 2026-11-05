import type { TodoImportance } from "@/features/todo/domain/todoTask";

export type AssistantMode = "tasks" | "day" | "week";
export type AssistantTask = {
  title: string;
  description: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  estimatedMinutes: number;
  importance: TodoImportance;
  productive: boolean;
};
export type AssistantPreview = { analysis: string; tasks: AssistantTask[]; from: string; to: string };
export type AssistantInstruction = { prompt: string; mode: AssistantMode; date: string };

export function isAssistantDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function isAssistantTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function resolveAssistantInstruction(prompt: string, mode: AssistantMode, date: string): AssistantInstruction {
  const command = prompt.trim().match(/^\/analyse\b(?:\s+(jour|day|semaine|week))?(?:\s+(\d{4}-\d{2}-\d{2}))?(?:\s+|$)/i);
  if (!command) return { prompt: prompt.trim(), mode, date };
  const commandDate = command[2] ?? date;
  if (!isAssistantDate(commandDate)) throw new Error("Invalid analysis date");
  return {
    prompt: prompt.trim().slice(command[0].length).trim(),
    mode: command[1]?.toLowerCase() === "semaine" || command[1]?.toLowerCase() === "week" ? "week" : "day",
    date: commandDate
  };
}

export function parseAssistantPreview(payload: unknown): AssistantPreview {
  const preview = expectRecord(payload);
  if (typeof preview.analysis !== "string" || preview.analysis.length > 12000 || !Array.isArray(preview.tasks) || preview.tasks.length > 20) throw new Error("Invalid assistant preview");
  if (typeof preview.from !== "string" || !isAssistantDate(preview.from) || typeof preview.to !== "string" || !isAssistantDate(preview.to) || preview.from > preview.to) throw new Error("Invalid assistant period");
  return { analysis: preview.analysis, tasks: preview.tasks.map(parseAssistantTask), from: preview.from, to: preview.to };
}

export function parseAssistantTask(payload: unknown): AssistantTask {
  const task = expectRecord(payload);
  if (typeof task.title !== "string" || !task.title.trim() || task.title.length > 240) throw new Error("Invalid assistant task title");
  const description = expectNullableString(task.description);
  if (description !== null && description.length > 3000) throw new Error("Invalid assistant task description");
  const date = expectNullableString(task.date);
  const startTime = expectNullableString(task.startTime);
  const endTime = expectNullableString(task.endTime);
  if (date !== null && !isAssistantDate(date)) throw new Error("Invalid assistant task date");
  if ((startTime !== null && !isAssistantTime(startTime)) || (endTime !== null && !isAssistantTime(endTime))) throw new Error("Invalid assistant task time");
  if (endTime !== null && (startTime === null || endTime <= startTime)) throw new Error("Invalid assistant task time range");
  if ((startTime !== null || endTime !== null) && date === null) throw new Error("Scheduled tasks require a date");
  if (typeof task.estimatedMinutes !== "number" || !Number.isInteger(task.estimatedMinutes) || task.estimatedMinutes < 0 || task.estimatedMinutes > 10080) throw new Error("Invalid assistant task duration");
  if (task.importance !== "low" && task.importance !== "medium" && task.importance !== "high") throw new Error("Invalid assistant task importance");
  if (typeof task.productive !== "boolean") throw new Error("Invalid assistant task productivity");
  return { title: task.title.trim(), description, date, startTime, endTime, estimatedMinutes: task.estimatedMinutes, importance: task.importance, productive: task.productive };
}

function expectRecord(payload: unknown): Record<string, unknown> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Expected an assistant object");
  return payload as Record<string, unknown>;
}

function expectNullableString(text: unknown): string | null {
  if (text === null || typeof text === "string") return text;
  throw new Error("Expected text or null");
}
