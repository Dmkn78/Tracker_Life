export type HabitStatus = "planned" | "done" | "skipped";

export type HabitCheckin = {
  id: string | null;
  status: string;
  actualMinutes: number;
  note: string;
};

export type Habit = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  targetTime: string | null;
  defaultExpectedMinutes: number;
  recurrenceDays: number[];
  timeBlockEnabled: boolean;
  sortOrder: number;
  source: string;
  checkin: HabitCheckin;
};

export type RoutineBlock = {
  id: string;
  habitId: string | null;
  dayType: string;
  recurrenceDays: number[];
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

export type HabitTemplate = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  targetTime: string | null;
  defaultExpectedMinutes: number;
  recurrenceDays: number[];
  timeBlockEnabled: boolean;
};

export type CalendarRoutinePlan = {
  id: string;
  blockId: string;
  habitId: string;
  title: string;
  category: string;
  start: string;
  end: string;
};

export type HabitTrackerData = {
  date: string;
  habits: Habit[];
  routineBlocks: RoutineBlock[];
  templates: HabitTemplate[];
  metrics: {
    completedToday: number;
    totalToday: number;
    completionRateToday: number;
    sevenDayCompletionRate: number;
  };
};

export type HabitDraft = {
  id?: string;
  name: string;
  category: string;
  description: string;
  targetTime: string;
  defaultExpectedMinutes: number;
  recurrenceDays: number[];
  timeBlockEnabled: boolean;
};

export type HabitCheckinPatch = {
  status?: HabitStatus;
  actualMinutes?: number;
  note?: string;
};
