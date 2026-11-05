"use client";

import { CalendarPlus, Trash2 } from "lucide-react";
import { parseDateKey } from "@/lib/dates";
import { buildDeadlineSummary, buildGoogleCalendarUrl, daysUntil, type Deadline } from "../domain/courses";
import type { CoursesCopy } from "./coursesCopy";

export function DeadlineRow({ deadline, courseName, courseColor, today, locale, copy, onRemove }: {
  deadline: Deadline;
  courseName: string | null;
  courseColor: string | null;
  today: string;
  locale: string;
  copy: CoursesCopy;
  onRemove: () => void;
}): React.ReactElement {
  const remainingDays = daysUntil(deadline.date, today);
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(parseDateKey(deadline.date));
  const kindLabel = copy.kinds[deadline.kind];
  const calendarUrl = buildGoogleCalendarUrl(deadline, buildDeadlineSummary(kindLabel, courseName, deadline.title));
  const isUrgent = remainingDays >= 0 && remainingDays <= 7;
  return (
    <li className={`flex items-start gap-3 rounded-xl bg-panel px-3 py-2 ring-1 ${isUrgent ? "ring-warn/50" : "ring-line"} ${remainingDays < 0 ? "opacity-60" : ""}`} style={courseColor ? { boxShadow: `inset 3px 0 0 ${courseColor}` } : undefined}>
      <div className="w-20 shrink-0 text-xs">
        <p className="font-semibold capitalize text-ink">{dateLabel}</p>
        <p className={isUrgent ? "text-warn" : "text-muted"}>{describeCountdown(remainingDays, copy)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm text-ink"><span className="font-semibold">{kindLabel}</span>{deadline.time ? ` · ${deadline.time}` : ""} — {deadline.title}</p>
        {courseName ? <p className="text-xs text-muted">{courseName}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a href={calendarUrl} target="_blank" rel="noopener noreferrer" title={copy.googleCalendar} aria-label={copy.googleCalendar} className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-accent hover:bg-accent/10">
          <CalendarPlus className="h-4 w-4" />
        </a>
        <button type="button" title={copy.removeDeadline} aria-label={copy.removeDeadline} onClick={onRemove} className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-panel2 hover:text-risk">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function describeCountdown(remainingDays: number, copy: CoursesCopy): string {
  if (remainingDays === 0) return copy.today;
  if (remainingDays === 1) return copy.tomorrow;
  const countdown = remainingDays > 0 ? copy.inDays.replace("{count}", String(remainingDays)) : copy.daysAgo.replace("{count}", String(-remainingDays));
  return countdown;
}
