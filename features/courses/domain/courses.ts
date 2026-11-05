export type DeadlineKind = "exam" | "assignment" | "other";

export type Course = { id: string; name: string; color: string; archived: boolean };

export type Deadline = {
  id: string;
  courseId: string | null;
  title: string;
  kind: DeadlineKind;
  date: string;
  time: string | null;
  durationMinutes: number;
  note: string | null;
};

export type CoursesData = { courses: Course[]; deadlines: Deadline[]; today: string };

export type DeadlineDraft = { courseId: string | null; title: string; kind: DeadlineKind; date: string; time: string };

export const DEADLINE_KINDS: readonly DeadlineKind[] = ["exam", "assignment", "other"];
export const UPCOMING_WINDOW_DAYS = 60;
const GOOGLE_CALENDAR_TEMPLATE_URL = "https://calendar.google.com/calendar/render";
const MILLISECONDS_PER_DAY = 86_400_000;

export function daysUntil(dateKey: string, todayKey: string): number {
  const remainingDays = Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / MILLISECONDS_PER_DAY);
  return remainingDays;
}

export function selectUpcomingDeadlines(deadlines: Deadline[], todayKey: string): Deadline[] {
  const upcoming = deadlines.filter((deadline) => {
    const remainingDays = daysUntil(deadline.date, todayKey);
    return remainingDays >= 0 && remainingDays <= UPCOMING_WINDOW_DAYS;
  });
  return upcoming;
}

export function deadlinesOfCourse(deadlines: Deadline[], courseId: string | null): Deadline[] {
  const courseDeadlines = deadlines.filter((deadline) => deadline.courseId === courseId);
  return courseDeadlines;
}

/**
 * "Add to Google Agenda" link: opens Google Agenda (app or web) with the event pre-filled.
 * Times without a time zone are read in the calendar's own zone, matching the local times stored here.
 */
export function buildGoogleCalendarUrl(deadline: Deadline, summary: string): string {
  const parameters = new URLSearchParams({ action: "TEMPLATE", text: summary, dates: formatGoogleDates(deadline) });
  if (deadline.note) parameters.set("details", deadline.note);
  const calendarUrl = `${GOOGLE_CALENDAR_TEMPLATE_URL}?${parameters.toString()}`;
  return calendarUrl;
}

export function isDeadlineDraftValid(draft: DeadlineDraft): boolean {
  const hasValidTime = draft.time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time);
  const isValid = draft.title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && hasValidTime;
  return isValid;
}

function formatGoogleDates(deadline: Deadline): string {
  const compactDate = deadline.date.replaceAll("-", "");
  if (deadline.time === null) {
    const nextDay = new Date(`${deadline.date}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const allDayRange = `${compactDate}/${nextDay.toISOString().slice(0, 10).replaceAll("-", "")}`;
    return allDayRange;
  }
  const start = new Date(`${deadline.date}T${deadline.time}:00Z`);
  const end = new Date(start.getTime() + deadline.durationMinutes * 60_000);
  const timedRange = `${toCompactLocalTime(start)}/${toCompactLocalTime(end)}`;
  return timedRange;
}

/** The Date is only used as a calendar calculator here (UTC fields = the user's wall-clock time). */
function toCompactLocalTime(moment: Date): string {
  const compactTime = moment.toISOString().slice(0, 19).replaceAll("-", "").replaceAll(":", "");
  return compactTime;
}

/** Same wording as the .ics export: "Examen — Probabilités · Partiel". */
export function buildDeadlineSummary(kindLabel: string, courseName: string | null, title: string): string {
  const coursePrefix = courseName ? `${courseName} · ` : "";
  const summary = `${kindLabel} — ${coursePrefix}${title}`;
  return summary;
}
