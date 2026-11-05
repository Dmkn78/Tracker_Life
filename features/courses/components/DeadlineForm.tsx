"use client";

import { useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { DEADLINE_KINDS, isDeadlineDraftValid, type DeadlineDraft } from "../domain/courses";
import type { CoursesCopy } from "./coursesCopy";

/** Title and date are enough; the kind defaults to an exam and the time is optional. */
export function DeadlineForm({ courseId, copy, onSave, onCancel }: {
  courseId: string | null;
  copy: CoursesCopy;
  onSave: (draft: DeadlineDraft) => Promise<void>;
  onCancel: () => void;
}): React.ReactElement {
  const [draft, setDraft] = useState<DeadlineDraft>({ courseId, title: "", kind: courseId ? "exam" : "other", date: "", time: "" });
  const change = (patch: Partial<DeadlineDraft>) => setDraft((current) => ({ ...current, ...patch }));

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!isDeadlineDraftValid(draft)) return;
    await onSave(draft);
    setDraft((current) => ({ ...current, title: "", time: "" }));
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-2 rounded-xl bg-panel2/60 p-3 ring-1 ring-line">
      <input autoFocus aria-label={copy.deadlineTitle} value={draft.title} placeholder={copy.deadlineTitle} onChange={(event) => change({ title: event.target.value })} className="focus-ring min-h-10 rounded-xl bg-panel px-3 text-sm text-ink ring-1 ring-line placeholder:text-muted/70" />
      <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
        {DEADLINE_KINDS.map((kind) => (
          <button key={kind} type="button" role="radio" aria-checked={draft.kind === kind} onClick={() => change({ kind })} className={`focus-ring min-h-8 rounded-full px-3 text-xs ring-1 ${draft.kind === kind ? "bg-accent/15 text-accent ring-accent/50" : "text-muted ring-line"}`}>
            {copy.kinds[kind]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="grid gap-1 text-xs text-muted">{copy.date}<input type="date" required value={draft.date} onChange={(event) => change({ date: event.target.value })} className="focus-ring min-h-10 rounded-xl bg-panel px-2 text-sm text-ink ring-1 ring-line" /></label>
        <label className="grid gap-1 text-xs text-muted">{copy.time}<input type="time" value={draft.time} onChange={(event) => change({ time: event.target.value })} className="focus-ring min-h-10 rounded-xl bg-panel px-2 text-sm text-ink ring-1 ring-line" /></label>
      </div>
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={!isDeadlineDraftValid(draft)}>{copy.save}</PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>{copy.cancel}</SecondaryButton>
      </div>
    </form>
  );
}
