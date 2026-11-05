"use client";

import { GraduationCap } from "lucide-react";
import type { BoardDeadline } from "../domain/weekBoard";

/** Exams and submissions of the day, so the week is planned around them. */
export function DeadlineBadges({ deadlines }: { deadlines: BoardDeadline[] }): React.ReactElement | null {
  if (!deadlines.length) return null;
  return (
    <ul className="grid gap-1">
      {deadlines.map((deadline) => (
        <li key={deadline.id} className="flex items-start gap-1.5 rounded-lg bg-warn/10 px-2 py-1 text-xs text-ink ring-1 ring-warn/30" style={deadline.courseColor ? { boxShadow: `inset 3px 0 0 ${deadline.courseColor}` } : undefined}>
          <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          <span className="min-w-0 break-words">
            <span className="font-semibold">{deadline.kindLabel}</span>
            {deadline.time ? ` ${deadline.time}` : ""} · {deadline.courseName ? `${deadline.courseName} — ` : ""}{deadline.title}
          </span>
        </li>
      ))}
    </ul>
  );
}
