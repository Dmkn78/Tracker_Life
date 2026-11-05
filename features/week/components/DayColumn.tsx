"use client";

import { useDroppable } from "@dnd-kit/core";
import { NotebookPen } from "lucide-react";
import { useState } from "react";
import type { BoardDay } from "../domain/weekBoard";
import { summarizeDays } from "../domain/weekBoard";
import { BoardTaskItem, type BoardTaskHandlers } from "./BoardTaskItem";
import { dayDropId } from "./boardDragAndDrop";
import { DeadlineBadges } from "./DeadlineBadges";
import { formatBoardDay } from "./dayLabels";
import { InlineTaskInput } from "./InlineTaskInput";
import { RecapField } from "./RecapField";
import type { WeekCopy } from "./weekCopy";

export function DayColumn({ day, isToday, isPast, locale, copy, handlers, onAdd, onRecap }: {
  day: BoardDay;
  isToday: boolean;
  isPast: boolean;
  locale: string;
  copy: WeekCopy;
  handlers: BoardTaskHandlers;
  onAdd: (title: string) => Promise<void>;
  onRecap: (text: string) => Promise<void>;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day.date) });
  const [isRecapOpen, setIsRecapOpen] = useState(Boolean(day.recap));
  const label = formatBoardDay(day.date, locale);
  const summary = summarizeDays([day]);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label.weekday} ${label.day}`}
      className={`flex min-h-40 min-w-0 flex-col gap-2 rounded-[20px] p-3 ring-1 transition ${isOver ? "bg-accent/10 ring-accent" : isToday ? "bg-panel ring-accent/60" : "bg-panel/60 ring-line"} ${isPast && !isToday ? "opacity-85" : ""}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="text-sm font-semibold capitalize text-ink">
          {label.weekday} <span className="font-normal text-muted">{label.day}</span>
        </h2>
        {isToday ? <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-onaccent">{copy.today}</span> : summary.planned ? <span className="text-xs text-muted">{summary.done}/{summary.planned}</span> : null}
      </header>
      <DeadlineBadges deadlines={day.deadlines} />
      <ul className="grid gap-1.5">
        {day.tasks.map((task) => <BoardTaskItem key={task.id} task={task} copy={copy} handlers={handlers} canShift />)}
      </ul>
      <InlineTaskInput label={copy.addTo} placeholder={copy.captureLabel} onSubmit={onAdd} />
      <div className="mt-auto border-t border-line/60 pt-2">
        {isRecapOpen ? (
          <RecapField label={`${copy.recap} ${label.weekday}`} placeholder={copy.dayRecapPlaceholder} initialText={day.recap} rows={2} onSave={onRecap} savedLabel={copy.saved} />
        ) : (
          <button type="button" onClick={() => setIsRecapOpen(true)} className="focus-ring flex items-center gap-1.5 rounded-lg px-1 text-xs text-muted hover:text-ink">
            <NotebookPen className="h-3.5 w-3.5" />{copy.recap}
          </button>
        )}
      </div>
    </section>
  );
}
