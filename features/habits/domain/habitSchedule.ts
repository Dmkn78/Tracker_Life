export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];

export function normalizeRecurrenceDays(days: readonly number[]): IsoWeekday[] {
  const normalized = [...new Set(days)]
    .filter((day): day is IsoWeekday => ISO_WEEKDAYS.includes(day as IsoWeekday))
    .sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [...ISO_WEEKDAYS];
}

export function isScheduledOnDate(dateKey: string, days: readonly number[]): boolean {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return normalizeRecurrenceDays(days).includes(isoWeekday as IsoWeekday);
}

export function formatRoutineEndDateTime(dateKey: string, startTime: string, durationMinutes: number): string {
  const start = new Date(`${dateKey}T${startTime}:00.000Z`);
  return new Date(start.getTime() + Math.max(0, durationMinutes) * 60_000)
    .toISOString()
    .slice(0, 16);
}
