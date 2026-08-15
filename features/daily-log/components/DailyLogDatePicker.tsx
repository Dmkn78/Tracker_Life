"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { IconButton, Panel, PrimaryButton, TextInput } from "@/components/ui";
import type { DayLogStatus } from "@/features/daily-log/domain/dailyLog";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { addDays, formatDisplayDate, parseDateKey, toDateKey } from "@/lib/dates";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function monthLabel(date: Date, locale: "en" | "fr") {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function buildMonthGrid(selectedDate: string) {
  const selected = parseDateKey(selectedDate);
  const first = monthStart(selected);
  const leadingDays = (first.getUTCDay() || 7) - 1;
  const gridStart = addDays(dateKey(first), -leadingDays);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function statusTone(status?: DayLogStatus) {
  if (status === "submitted" || status === "analyzed") return "border-good/50 bg-good/10 text-good";
  if (status === "draft") return "border-accent/50 bg-accent/10 text-accent";
  if (status === "skipped") return "border-line bg-panel2/40 text-muted";
  if (status === "missing") return "border-risk/45 bg-risk/10 text-risk";
  return "border-line bg-shell text-muted";
}

export function DailyLogDatePicker({
  selectedDate,
  statuses
}: {
  selectedDate: string;
  statuses: Record<string, DayLogStatus>;
}) {
  const { locale } = useLocale();
  const copy = DATE_PICKER_COPY[locale];
  const weekDays = locale === "fr" ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const selected = parseDateKey(selectedDate);
  const month = monthStart(selected);
  const previousMonth = dateKey(addMonths(month, -1));
  const nextMonth = dateKey(addMonths(month, 1));
  const today = toDateKey();
  const days = buildMonthGrid(selectedDate);

  return (
    <Panel className="mb-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-accent/40 bg-accent/10 text-accent">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">{copy.calendar}</p>
            <h2 className="text-xl font-semibold text-ink">{formatDisplayDate(selectedDate)}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/daily-log?date=${previousMonth}`}>
            <IconButton type="button">{copy.previous}</IconButton>
          </Link>
          <Link href={`/daily-log?date=${today}`}>
            <PrimaryButton type="button">{copy.today}</PrimaryButton>
          </Link>
          <Link href={`/daily-log?date=${nextMonth}`}>
            <IconButton type="button">{copy.next}</IconButton>
          </Link>
          <form action="/daily-log" className="flex items-center gap-2">
            <TextInput type="date" name="date" defaultValue={selectedDate} className="w-auto" />
            <IconButton type="submit">{copy.open}</IconButton>
          </form>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-line bg-shell p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-ink">{monthLabel(month, locale)}</h3>
          <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase">
            <span className="text-good">submitted</span>
            <span className="text-accent">draft</span>
            <span className="text-risk">missing</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div key={day} className="px-2 py-1 text-center font-mono text-[11px] font-semibold uppercase text-muted">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const date = parseDateKey(day);
            const inMonth = date.getUTCMonth() === month.getUTCMonth();
            const selectedDay = day === selectedDate;
            const status = statuses[day];
            return (
              <Link
                key={day}
                href={`/daily-log?date=${day}`}
                className={`focus-ring min-h-16 rounded-md border p-2 transition hover:border-accent hover:bg-accent/10 ${
                  selectedDay ? "border-accent bg-accent/15 text-accent" : `${statusTone(status)} ${inMonth ? "" : "opacity-40"}`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">{date.getUTCDate()}</span>
                  {day === today ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                </div>
                <p className="mt-3 truncate font-mono text-[10px] uppercase">{status ?? copy.noLog}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

const DATE_PICKER_COPY = {
  en: { calendar: "Daily Log Calendar", previous: "Previous month", today: "Today", next: "Next month", open: "Open", noLog: "no log" },
  fr: { calendar: "Calendrier du journal", previous: "Mois précédent", today: "Aujourd’hui", next: "Mois suivant", open: "Ouvrir", noLog: "aucun journal" }
} as const;
