"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { SecondaryButton } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { getIsoWeekId } from "@/lib/dates";
import { useWeekBoard, type WeekBoardActions } from "../application/useWeekBoard";
import { defaultCaptureDate, shiftDestination, type BoardTask, type WeekBoard } from "../domain/weekBoard";
import type { BoardTaskHandlers } from "./BoardTaskItem";
import { detectDropTarget, readDropDestination, useBoardSensors } from "./boardDragAndDrop";
import { DayColumn } from "./DayColumn";
import { InboxColumn } from "./InboxColumn";
import { QuickCapture } from "./QuickCapture";
import { RecapField } from "./RecapField";
import { WeekHeader } from "./WeekHeader";
import { WEEK_COPY, type WeekCopy } from "./weekCopy";

export function WeekBoardView(): React.ReactElement {
  const { locale } = useLocale();
  const copy = WEEK_COPY[locale];
  const { state, actionError, actions } = useWeekBoard();

  if (state.kind === "loading") return <p className="text-sm text-muted">{copy.loading}</p>;
  if (state.kind === "failed") {
    return (
      <div className="grid gap-3">
        <p role="alert" className="text-sm text-risk">{copy.failed} {state.message}</p>
        <SecondaryButton type="button" onClick={() => actions.showWeek(getIsoWeekId())}>{copy.retry}</SecondaryButton>
      </div>
    );
  }
  return <ReadyWeekBoard board={state.board} actions={actions} actionError={actionError} locale={locale} copy={copy} />;
}

function ReadyWeekBoard({ board, actions, actionError, locale, copy }: {
  board: WeekBoard;
  actions: WeekBoardActions;
  actionError: string;
  locale: string;
  copy: WeekCopy;
}): React.ReactElement {
  const sensors = useBoardSensors();
  const handlers: BoardTaskHandlers = {
    onToggle: (task) => void actions.toggleTask(task),
    onNotDone: (task) => void actions.markNotDone(task),
    onRename: (task, title) => void actions.renameTask(task, title),
    onShift: (task, dayOffset) => moveByOffset(board, actions, task, dayOffset),
    onRemove: (task) => { if (window.confirm(copy.confirmRemove)) void actions.removeTask(task); }
  };

  function handleDragEnd(event: DragEndEvent): void {
    const destination = readDropDestination(event.over?.id);
    if (destination) void actions.moveTask(String(event.active.id), destination);
  }

  return (
    <div className="grid gap-5">
      <WeekHeader board={board} eyebrow={copy.eyebrow} locale={locale} copy={copy} onShowWeek={actions.showWeek}>
        <Link href="/objectives/planning" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-2xl bg-panel2 px-3.5 text-sm font-medium text-ink ring-1 ring-line"><CalendarRange className="h-4 w-4" />{copy.planAhead}</Link>
      </WeekHeader>
      <QuickCapture days={board.days} defaultDate={defaultCaptureDate(board)} locale={locale} copy={copy} onAdd={actions.addTask} />
      {actionError ? <p role="alert" className="text-sm text-risk">{actionError}</p> : null}
      <DndContext sensors={sensors} collisionDetection={detectDropTarget} onDragEnd={handleDragEnd}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {board.days.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              isToday={day.date === board.today}
              isPast={day.date < board.today}
              locale={locale}
              copy={copy}
              handlers={handlers}
              onAdd={(title) => actions.addTask(title, { kind: "day", date: day.date })}
              onRecap={(text) => actions.writeRecap({ kind: "day", date: day.date }, text)}
            />
          ))}
        </div>
        <InboxColumn tasks={board.inbox} copy={copy} handlers={handlers} onAdd={(title) => actions.addTask(title, { kind: "inbox" })} />
      </DndContext>
      <section className="grid gap-2 rounded-[20px] bg-panel/60 p-4 ring-1 ring-line">
        <h2 className="text-sm font-semibold text-ink">{copy.weekRecap}</h2>
        <RecapField label={copy.weekRecap} placeholder={copy.weekRecapPlaceholder} initialText={board.recap} rows={3} savedLabel={copy.saved} onSave={(text) => actions.writeRecap({ kind: "week", weekId: board.weekId }, text)} />
      </section>
    </div>
  );
}

function moveByOffset(board: WeekBoard, actions: WeekBoardActions, task: BoardTask, dayOffset: number): void {
  const destination = shiftDestination(board, task, dayOffset);
  if (destination) void actions.moveTask(task.id, destination);
}
