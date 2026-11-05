"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { GhostButton } from "@/components/ui";
import { daysUntil, type Course, type Deadline, type DeadlineDraft } from "../domain/courses";
import type { CoursesCopy } from "./coursesCopy";
import { DeadlineForm } from "./DeadlineForm";
import { DeadlineRow } from "./DeadlineRow";

export type CourseCardActions = {
  rename: (course: Course, name: string) => Promise<void>;
  remove: (course: Course) => Promise<void>;
  addDeadline: (draft: DeadlineDraft) => Promise<void>;
  removeDeadline: (deadline: Deadline) => Promise<void>;
};

/** One course (or the "other dates" group when `course` is null) with its dates. */
export function CourseCard({ course, deadlines, today, locale, copy, actions }: {
  course: Course | null;
  deadlines: Deadline[];
  today: string;
  locale: string;
  copy: CoursesCopy;
  actions: CourseCardActions;
}): React.ReactElement {
  const [isAdding, setIsAdding] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const upcoming = deadlines.filter((deadline) => daysUntil(deadline.date, today) >= 0);
  const past = deadlines.filter((deadline) => daysUntil(deadline.date, today) < 0);

  function commitName(): void {
    const nextName = draftName?.trim();
    setDraftName(null);
    if (course && nextName && nextName !== course.name) void actions.rename(course, nextName);
  }

  return (
    <li className="grid gap-3 rounded-[22px] bg-panel/90 p-4 ring-1 ring-line">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: course?.color ?? "rgb(var(--color-muted))" }} aria-hidden="true" />
          {course && draftName !== null ? (
            <input autoFocus aria-label={copy.rename} value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={commitName} onKeyDown={(event) => { if (event.key === "Enter") commitName(); if (event.key === "Escape") setDraftName(null); }} className="focus-ring min-w-0 flex-1 rounded-lg bg-panel2 px-2 py-1 font-semibold text-ink ring-1 ring-line" />
          ) : (
            <button type="button" disabled={!course} title={course ? copy.rename : undefined} onClick={() => course && setDraftName(course.name)} className="min-w-0 break-words text-left text-lg font-semibold text-ink">{course?.name ?? copy.otherDates}</button>
          )}
        </div>
        {course ? <GhostButton type="button" aria-label={copy.removeCourse} title={copy.removeCourse} onClick={() => void actions.remove(course)}><Trash2 className="h-4 w-4" /></GhostButton> : null}
      </header>
      {upcoming.length ? (
        <ul className="grid gap-1.5">
          {upcoming.map((deadline) => <DeadlineRow key={deadline.id} deadline={deadline} courseName={course?.name ?? null} courseColor={course?.color ?? null} today={today} locale={locale} copy={copy} onRemove={() => void actions.removeDeadline(deadline)} />)}
        </ul>
      ) : null}
      {past.length ? (
        <details>
          <summary className="cursor-pointer text-xs text-muted">{copy.past} ({past.length})</summary>
          <ul className="mt-2 grid gap-1.5">
            {past.map((deadline) => <DeadlineRow key={deadline.id} deadline={deadline} courseName={course?.name ?? null} courseColor={course?.color ?? null} today={today} locale={locale} copy={copy} onRemove={() => void actions.removeDeadline(deadline)} />)}
          </ul>
        </details>
      ) : null}
      {isAdding ? (
        <DeadlineForm courseId={course?.id ?? null} copy={copy} onCancel={() => setIsAdding(false)} onSave={actions.addDeadline} />
      ) : (
        <button type="button" onClick={() => setIsAdding(true)} className="focus-ring flex min-h-9 w-fit items-center gap-2 rounded-xl px-2 text-sm text-muted hover:bg-panel2 hover:text-ink">
          <Plus className="h-4 w-4" />{copy.addDeadline}
        </button>
      )}
    </li>
  );
}
