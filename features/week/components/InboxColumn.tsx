"use client";

import { useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";
import type { BoardTask } from "../domain/weekBoard";
import { BoardTaskItem, type BoardTaskHandlers } from "./BoardTaskItem";
import { InlineTaskInput } from "./InlineTaskInput";
import type { WeekCopy } from "./weekCopy";

export const INBOX_DROP_ID = "inbox";

export function InboxColumn({ tasks, copy, handlers, onAdd }: {
  tasks: BoardTask[];
  copy: WeekCopy;
  handlers: BoardTaskHandlers;
  onAdd: (title: string) => Promise<void>;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: INBOX_DROP_ID });
  return (
    <section ref={setNodeRef} aria-label={copy.inbox} className={`grid gap-2 rounded-[20px] p-3 ring-1 transition ${isOver ? "bg-accent/10 ring-accent" : "bg-panel2/50 ring-line"}`}>
      <header>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Inbox className="h-4 w-4" />{copy.inbox} <span className="font-normal text-muted">{tasks.length}</span></h2>
        <p className="mt-0.5 text-xs text-muted">{copy.inboxHint}</p>
      </header>
      <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => <BoardTaskItem key={task.id} task={task} copy={copy} handlers={handlers} canShift={false} />)}
      </ul>
      <InlineTaskInput label={copy.addTo} placeholder={copy.captureLabel} onSubmit={onAdd} />
    </section>
  );
}
