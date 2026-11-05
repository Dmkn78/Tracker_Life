"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui";
import type { BoardDay, TaskDestination } from "../domain/weekBoard";
import { formatBoardDay } from "./dayLabels";
import type { WeekCopy } from "./weekCopy";

const INBOX_OPTION = "inbox";

/** The main action of the app: write what you have to do, press Enter. The day is pre-selected. */
export function QuickCapture({ days, defaultDate, locale, copy, onAdd }: {
  days: BoardDay[];
  defaultDate: string;
  locale: string;
  copy: WeekCopy;
  onAdd: (title: string, destination: TaskDestination) => Promise<void>;
}): React.ReactElement {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(defaultDate);

  useEffect(() => { setTarget(defaultDate); }, [defaultDate]);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setTitle("");
    const destination: TaskDestination = target === INBOX_OPTION ? { kind: "inbox" } : { kind: "day", date: target };
    await onAdd(trimmedTitle, destination);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2 rounded-[22px] bg-panel p-2 ring-1 ring-line sm:flex-row sm:items-center">
      <input
        aria-label={copy.captureLabel}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={copy.capturePlaceholder}
        className="focus-ring min-h-11 min-w-0 flex-1 rounded-2xl bg-transparent px-3 text-base text-ink placeholder:text-muted/70"
      />
      <div className="flex gap-2">
        <select
          aria-label={copy.captureFor}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="focus-ring min-h-11 flex-1 rounded-2xl bg-panel2 px-3 text-sm capitalize text-ink ring-1 ring-line sm:flex-none"
        >
          {days.map((day) => <option key={day.date} value={day.date}>{formatBoardDay(day.date, locale).weekday}</option>)}
          <option value={INBOX_OPTION}>{copy.inbox}</option>
        </select>
        <PrimaryButton type="submit" disabled={!title.trim()} className="min-h-11"><Plus className="h-4 w-4" />{copy.add}</PrimaryButton>
      </div>
    </form>
  );
}
