import { parseDateKey } from "@/lib/dates";

export function formatBoardDay(dateKey: string, locale: string): { weekday: string; day: string } {
  const date = parseDateKey(dateKey);
  const dayLabel = {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date),
    day: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(date)
  };
  return dayLabel;
}

export function formatWeekRange(firstDate: string, lastDate: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" });
  const weekRange = `${formatter.format(parseDateKey(firstDate))} – ${formatter.format(parseDateKey(lastDate))}`;
  return weekRange;
}
