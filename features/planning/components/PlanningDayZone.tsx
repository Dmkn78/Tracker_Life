"use client";

import { useDroppable } from "@dnd-kit/core";
import { dayDropId } from "@/features/week/components/boardDragAndDrop";
import { formatBoardDay } from "@/features/week/components/dayLabels";
import { DeadlineBadges } from "@/features/week/components/DeadlineBadges";
import { summarizeDays, type BoardDay } from "@/features/week/domain/weekBoard";
import { PlanningTaskCard, type PlanningTaskActions } from "./PlanningTaskCard";
import type { PlanningCopy } from "./planningCopy";

export function PlanningDayZone({ day, days, isToday, locale, copy, actions }: {
  day: BoardDay;
  days: BoardDay[];
  isToday: boolean;
  locale: string;
  copy: PlanningCopy;
  actions: PlanningTaskActions;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day.date) });
  const label = formatBoardDay(day.date, locale);
  const summary = summarizeDays([day]);
  return (
    <section ref={setNodeRef} aria-label={`${label.weekday} ${label.day}`} className={`flex min-h-32 min-w-0 flex-col gap-2 rounded-[20px] p-3 ring-1 transition ${isOver ? "bg-accent/10 ring-accent" : isToday ? "bg-panel ring-accent/60" : "bg-panel/60 ring-line"}`}>
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold capitalize text-ink">{label.weekday} <span className="font-normal text-muted">{label.day}</span></h2>
        <span className="text-xs text-muted">{isToday ? copy.today : summary.planned ? `${summary.done}/${summary.planned}` : ""}</span>
      </header>
      <DeadlineBadges deadlines={day.deadlines} />
      {day.tasks.length ? (
        <ul className="grid gap-1.5">
          {day.tasks.map((task) => <PlanningTaskCard key={task.id} task={task} days={days} locale={locale} copy={copy} actions={actions} />)}
        </ul>
      ) : (
        <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line px-2 py-3 text-center text-xs text-muted">{copy.dayEmpty}</p>
      )}
    </section>
  );
}
