import {
  expectBoolean,
  expectNullableString,
  expectJsonObject,
  expectNumber,
  expectString,
  parseJsonArray,
  requestJson
} from "@/lib/http/apiClient";
import {
  type Habit,
  type CalendarRoutinePlan,
  type HabitDraft,
  type HabitTemplate,
  type HabitTrackerData,
  type RoutineBlock
} from "../domain/habit";

type SaveHabitCheckinInput = {
  habitId: string;
  date: string;
  status?: string;
  actualMinutes?: number;
  note?: string;
};

export function loadHabitTracker(
  date: string,
  signal?: AbortSignal
): Promise<HabitTrackerData> {
  const query = new URLSearchParams({ date });
  return requestJson(`/api/habits?${query.toString()}`, parseHabitTrackerData, {
    signal
  });
}

export function saveHabitCheckin(
  input: SaveHabitCheckinInput
): Promise<HabitTrackerData> {
  return requestJson("/api/habits", parseHabitTrackerData, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "checkin", ...input })
  });
}

export function createHabit(input: HabitDraft, saveAsTemplate = false): Promise<string> {
  return requestJson("/api/habits", parseHabitMutationResponse, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, saveAsTemplate })
  });
}

export async function deleteHabitTemplate(id: string): Promise<void> {
  const query = new URLSearchParams({ id, kind: "template" });
  await requestJson(`/api/habits?${query.toString()}`, (payload) => {
    const response = expectJsonObject(payload, "delete habit template response");
    if (response.ok !== true) throw new Error("delete habit template response.ok must be true");
    return true;
  }, { method: "DELETE" });
}

export function loadCalendarRoutinePlans(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<CalendarRoutinePlan[]> {
  const query = new URLSearchParams({ kind: "calendar", from, to });
  return requestJson(`/api/habits?${query.toString()}`, parseCalendarRoutinePlans, { signal });
}

export function updateHabit(input: HabitDraft & { id: string }): Promise<string> {
  return requestJson("/api/habits", parseHabitMutationResponse, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function deleteHabit(id: string, date: string): Promise<HabitTrackerData> {
  const query = new URLSearchParams({ id, date });
  return requestJson(`/api/habits?${query.toString()}`, parseHabitTrackerData, {
    method: "DELETE"
  });
}

export function parseHabitTrackerData(payload: unknown): HabitTrackerData {
  const tracker = expectJsonObject(payload, "habit tracker response");
  const metrics = expectJsonObject(tracker.metrics, "habit tracker response.metrics");
  return {
    date: expectString(tracker.date, "habit tracker response.date"),
    habits: parseJsonArray(tracker.habits, "habit tracker response.habits", parseHabit),
    routineBlocks: parseJsonArray(
      tracker.routineBlocks,
      "habit tracker response.routineBlocks",
      parseRoutineBlock
    ),
    templates: parseJsonArray(tracker.templates, "habit tracker response.templates", parseHabitTemplate),
    metrics: {
      completedToday: expectNumber(metrics.completedToday, "habit tracker response.metrics.completedToday"),
      totalToday: expectNumber(metrics.totalToday, "habit tracker response.metrics.totalToday"),
      completionRateToday: expectNumber(
        metrics.completionRateToday,
        "habit tracker response.metrics.completionRateToday"
      ),
      sevenDayCompletionRate: expectNumber(
        metrics.sevenDayCompletionRate,
        "habit tracker response.metrics.sevenDayCompletionRate"
      )
    }
  };
}

function parseHabitMutationResponse(payload: unknown): string {
  const response = expectJsonObject(payload, "habit mutation response");
  const habit = expectJsonObject(response.habit, "habit mutation response.habit");
  return expectString(habit.id, "habit mutation response.habit.id");
}

function parseHabit(payload: unknown, context: string): Habit {
  const habit = expectJsonObject(payload, context);
  const checkin = expectJsonObject(habit.checkin, `${context}.checkin`);
  return {
    id: expectString(habit.id, `${context}.id`),
    name: expectString(habit.name, `${context}.name`),
    category: expectString(habit.category, `${context}.category`),
    description: expectNullableString(habit.description, `${context}.description`),
    targetTime: expectNullableString(habit.targetTime, `${context}.targetTime`),
    defaultExpectedMinutes: expectNumber(
      habit.defaultExpectedMinutes,
      `${context}.defaultExpectedMinutes`
    ),
    recurrenceDays: parseNumberArray(habit.recurrenceDays, `${context}.recurrenceDays`),
    timeBlockEnabled: expectBoolean(habit.timeBlockEnabled, `${context}.timeBlockEnabled`),
    sortOrder: expectNumber(habit.sortOrder, `${context}.sortOrder`),
    source: expectString(habit.source, `${context}.source`),
    checkin: {
      id: expectNullableString(checkin.id, `${context}.checkin.id`),
      status: expectString(checkin.status, `${context}.checkin.status`),
      actualMinutes: expectNumber(checkin.actualMinutes, `${context}.checkin.actualMinutes`),
      note: expectString(checkin.note, `${context}.checkin.note`)
    }
  };
}

function parseRoutineBlock(payload: unknown, context: string): RoutineBlock {
  const block = expectJsonObject(payload, context);
  return {
    id: expectString(block.id, `${context}.id`),
    habitId: expectNullableString(block.habitId, `${context}.habitId`),
    dayType: expectString(block.dayType, `${context}.dayType`),
    recurrenceDays: parseNumberArray(block.recurrenceDays, `${context}.recurrenceDays`),
    label: expectString(block.label, `${context}.label`),
    startTime: expectString(block.startTime, `${context}.startTime`),
    endTime: expectString(block.endTime, `${context}.endTime`),
    sortOrder: expectNumber(block.sortOrder, `${context}.sortOrder`)
  };
}

function parseHabitTemplate(payload: unknown, context: string): HabitTemplate {
  const template = expectJsonObject(payload, context);
  return {
    id: expectString(template.id, `${context}.id`),
    name: expectString(template.name, `${context}.name`),
    category: expectString(template.category, `${context}.category`),
    description: expectNullableString(template.description, `${context}.description`),
    targetTime: expectNullableString(template.targetTime, `${context}.targetTime`),
    defaultExpectedMinutes: expectNumber(template.defaultExpectedMinutes, `${context}.defaultExpectedMinutes`),
    recurrenceDays: parseNumberArray(template.recurrenceDays, `${context}.recurrenceDays`),
    timeBlockEnabled: expectBoolean(template.timeBlockEnabled, `${context}.timeBlockEnabled`)
  };
}

function parseCalendarRoutinePlans(payload: unknown): CalendarRoutinePlan[] {
  const response = expectJsonObject(payload, "calendar routine response");
  return parseJsonArray(response.routines, "calendar routine response.routines", (value, context) => {
    const routine = expectJsonObject(value, context);
    return {
      id: expectString(routine.id, `${context}.id`),
      blockId: expectString(routine.blockId, `${context}.blockId`),
      habitId: expectString(routine.habitId, `${context}.habitId`),
      title: expectString(routine.title, `${context}.title`),
      category: expectString(routine.category, `${context}.category`),
      start: expectString(routine.start, `${context}.start`),
      end: expectString(routine.end, `${context}.end`)
    };
  });
}

function parseNumberArray(payload: unknown, context: string): number[] {
  return parseJsonArray(payload, context, (value, itemContext) => expectNumber(value, itemContext));
}
