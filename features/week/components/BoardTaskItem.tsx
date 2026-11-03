"use client";

import { useDraggable } from "@dnd-kit/core";
import { Check, ChevronLeft, ChevronRight, Target, Trash2, X } from "lucide-react";
import { useState } from "react";
import { isDoneStatus, isDroppedStatus, type BoardTask } from "../domain/weekBoard";
import type { WeekCopy } from "./weekCopy";

export type BoardTaskHandlers = {
  onToggle: (task: BoardTask) => void;
  onNotDone: (task: BoardTask) => void;
  onRename: (task: BoardTask, title: string) => void;
  onShift: (task: BoardTask, dayOffset: number) => void;
  onRemove: (task: BoardTask) => void;
};

export function BoardTaskItem({ task, copy, handlers, canShift }: {
  task: BoardTask;
  copy: WeekCopy;
  handlers: BoardTaskHandlers;
  canShift: boolean;
}): React.ReactElement {
  // Only pointer listeners: arrow buttons are the keyboard alternative, so no nested role="button".
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const isDone = isDoneStatus(task.status);
  const isDropped = isDroppedStatus(task.status);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  function commitTitle(): void {
    const nextTitle = draftTitle?.trim();
    setDraftTitle(null);
    if (nextTitle && nextTitle !== task.title) handlers.onRename(task, nextTitle);
  }

  return (
    <li ref={setNodeRef} style={style} className={`group relative flex items-start gap-2 rounded-xl bg-panel/80 px-2 py-1.5 ring-1 ring-line/60 ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}>
      <button
        type="button"
        aria-label={isDone || isDropped ? copy.reopen : copy.toggle}
        aria-pressed={isDone}
        onClick={() => handlers.onToggle(task)}
        className="focus-ring -my-1 inline-flex w-7 shrink-0 items-center justify-center self-stretch rounded-lg sm:self-auto"
      >
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md ring-1 transition ${isDone ? "bg-good text-onaccent ring-good" : isDropped ? "bg-risk/20 text-risk ring-risk/50" : "ring-line hover:ring-accent"}`}>
          {isDone ? <Check className="h-3.5 w-3.5" /> : isDropped ? <X className="h-3.5 w-3.5" /> : null}
        </span>
      </button>
      <div className="min-w-0 flex-1 touch-pan-y" {...listeners}>
        {draftTitle !== null ? (
          <input
            autoFocus
            aria-label={copy.edit}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={commitTitle}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitTitle();
              if (event.key === "Escape") setDraftTitle(null);
            }}
            className="focus-ring w-full rounded-md bg-panel2 px-1.5 py-0.5 text-sm text-ink ring-1 ring-line"
          />
        ) : (
          <button type="button" onClick={() => setDraftTitle(task.title)} title={copy.edit} className={`w-full cursor-text break-words text-left text-sm leading-5 ${isDone ? "text-muted line-through" : isDropped ? "text-risk/80 line-through" : "text-ink"}`}>
            {task.title}
          </button>
        )}
        {task.objectiveTitle ? <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted"><Target className="h-3 w-3" />{task.objectiveTitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center md:absolute md:right-1 md:top-1 md:hidden md:rounded-lg md:bg-panel md:shadow-lg md:ring-1 md:ring-line md:group-focus-within:flex md:group-hover:flex">
        {canShift ? <IconAction label={copy.moveEarlier} onClick={() => handlers.onShift(task, -1)}><ChevronLeft className="h-3.5 w-3.5" /></IconAction> : null}
        {canShift ? <IconAction label={copy.moveLater} onClick={() => handlers.onShift(task, 1)}><ChevronRight className="h-3.5 w-3.5" /></IconAction> : null}
        {!isDone && !isDropped ? <IconAction label={copy.notDone} onClick={() => handlers.onNotDone(task)}><X className="h-3.5 w-3.5" /></IconAction> : null}
        <IconAction label={copy.remove} onClick={() => handlers.onRemove(task)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
      </div>
    </li>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-panel2 hover:text-ink">
      {children}
    </button>
  );
}
