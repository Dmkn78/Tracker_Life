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
  sortOrder: number;
  source: string;
  checkin: HabitCheckin;
};

export type RoutineBlock = {
  id: string;
  habitId: string | null;
  dayType: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

export type HabitTrackerData = {
  date: string;
  habits: Habit[];
  routineBlocks: RoutineBlock[];
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
};

export type HabitCheckinPatch = {
  status?: HabitStatus;
  actualMinutes?: number;
  note?: string;
};
