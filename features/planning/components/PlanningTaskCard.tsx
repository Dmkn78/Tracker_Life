"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarPlus, Check, GripVertical, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { formatBoardDay } from "@/features/week/components/dayLabels";
import { isDoneStatus, type BoardDay, type BoardTask } from "@/features/week/domain/weekBoard";
import type { PlanningCopy } from "./planningCopy";

export type PlanningTaskActions = {
  planOn: (task: BoardTask, date: string) => void;
  unplan: (task: BoardTask) => void;
  toggle: (task: BoardTask) => void;
  remove: (task: BoardTask) => void;
};

/** A task card that can be dragged, or planned with one tap on a day chip (phone-friendly). */
export function PlanningTaskCard({ task, days, locale, copy, actions }: {
  task: BoardTask;
  days: BoardDay[];
  locale: string;
  copy: PlanningCopy;
  actions: PlanningTaskActions;
}): React.ReactElement {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const [isChoosingDay, setIsChoosingDay] = useState(false);
  const isScheduled = task.date !== null;
  const isDone = isDoneStatus(task.status);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <li ref={setNodeRef} style={style} className={`grid gap-2 rounded-xl bg-panel px-2.5 py-2 ring-1 ring-line ${isDragging ? "z-10 opacity-85 shadow-xl" : ""}`}>
      <div className="flex items-start gap-1.5">
        <span {...listeners} className="mt-0.5 cursor-grab touch-none text-muted" aria-hidden="true"><GripVertical className="h-4 w-4" /></span>
        <p className={`min-w-0 flex-1 break-words text-sm leading-5 ${isDone ? "text-muted line-through" : "text-ink"}`} {...listeners}>{task.title}</p>
        <div className="flex shrink-0 items-center">
          {isScheduled ? (
            <>
              <CardAction label={isDone ? copy.reopen : copy.done} onClick={() => actions.toggle(task)}><Check className="h-3.5 w-3.5" /></CardAction>
              <CardAction label={copy.unplan} onClick={() => actions.unplan(task)}><Undo2 className="h-3.5 w-3.5" /></CardAction>
            </>
          ) : (
            <button type="button" aria-expanded={isChoosingDay} onClick={() => setIsChoosingDay((current) => !current)} className="focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-accent hover:bg-accent/10">
              <CalendarPlus className="h-3.5 w-3.5" />{copy.plan}
            </button>
          )}
          <CardAction label={copy.remove} onClick={() => actions.remove(task)}><Trash2 className="h-3.5 w-3.5" /></CardAction>
        </div>
      </div>
      {isChoosingDay ? (
        <div role="group" aria-label={copy.choose} className="flex flex-wrap gap-1.5">
          {days.map((day) => {
            const label = formatBoardDay(day.date, locale);
            return (
              <button key={day.date} type="button" onClick={() => { setIsChoosingDay(false); actions.planOn(task, day.date); }} className="focus-ring min-h-9 rounded-full px-3 text-xs capitalize text-ink ring-1 ring-line hover:bg-accent/10 hover:ring-accent">
                {label.weekday.slice(0, 3)}. {label.day}
              </button>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

function CardAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel2 hover:text-ink">
      {children}
    </button>
  );
}
