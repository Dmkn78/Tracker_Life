export const TIME_ALLOCATION_PERIODS = ["day", "week", "month"] as const;
export type TimeAllocationPeriod = (typeof TIME_ALLOCATION_PERIODS)[number];

export type TimeAllocationPeriodRange = {
  period: TimeAllocationPeriod;
  anchor: string;
  start: string;
  end: string;
  endExclusive: string;
  maximumBudgetMinutes: number;
};

export function isTimeAllocationPeriod(value: string | null | undefined): value is TimeAllocationPeriod {
  return TIME_ALLOCATION_PERIODS.some((period) => period === value);
}

export function canonicalAllocationAnchor(period: TimeAllocationPeriod, dateKey = toDateKey()): string {
  if (period === "day") return dateKey;
  if (period === "week") return getWeekDateKeys(getIsoWeekId(dateKey))[0];
  return `${dateKey.slice(0, 7)}-01`;
}

export function getAllocationPeriodRange(
  period: TimeAllocationPeriod,
  dateKey = toDateKey()
): TimeAllocationPeriodRange {
  const anchor = canonicalAllocationAnchor(period, dateKey);
  if (period === "day") {
    return { period, anchor, start: anchor, end: anchor, endExclusive: addDays(anchor, 1), maximumBudgetMinutes: 1_440 };
  }
  if (period === "week") {
    return { period, anchor, start: anchor, end: addDays(anchor, 6), endExclusive: addDays(anchor, 7), maximumBudgetMinutes: 10_080 };
  }
  const firstDay = parseDateKey(anchor);
  const nextMonth = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 1));
  const endExclusive = nextMonth.toISOString().slice(0, 10);
  const dayCount = Math.round((nextMonth.getTime() - firstDay.getTime()) / 86_400_000);
  return { period, anchor, start: anchor, end: addDays(endExclusive, -1), endExclusive, maximumBudgetMinutes: dayCount * 1_440 };
}

export function shiftAllocationPeriod(anchor: string, period: TimeAllocationPeriod, offset: number): string {
  if (period === "day") return addDays(anchor, offset);
  if (period === "week") return addDays(canonicalAllocationAnchor(period, anchor), offset * 7);
  const date = parseDateKey(canonicalAllocationAnchor(period, anchor));
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function toDateKey(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getIsoWeekId(dateKey: string): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function getWeekDateKeys(weekId: string): string[] {
  const [yearValue, weekValue] = weekId.split("-W");
  const januaryFourth = new Date(Date.UTC(Number(yearValue), 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - (januaryFourth.getUTCDay() || 7) + 1 + (Number(weekValue) - 1) * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}
