"use client";

import { DndContext, PointerSensor, TouchSensor, pointerWithin, rectIntersection, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProgressBar, SecondaryButton } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { getIsoWeekId } from "@/lib/dates";
import { useWeekBoard, type WeekBoardActions } from "../application/useWeekBoard";
import { defaultCaptureDate, shiftDestination, type BoardTask, type TaskDestination, type WeekBoard } from "../domain/weekBoard";
import type { BoardTaskHandlers } from "./BoardTaskItem";
import { formatWeekRange } from "./dayLabels";
import { DayColumn } from "./DayColumn";
import { INBOX_DROP_ID, InboxColumn } from "./InboxColumn";
import { QuickCapture } from "./QuickCapture";
import { RecapField } from "./RecapField";
import { WEEK_COPY, type WeekCopy } from "./weekCopy";

const DRAG_ACTIVATION_DISTANCE_PX = 6;
const TOUCH_DRAG_DELAY_MS = 250;
const TOUCH_DRAG_TOLERANCE_PX = 6;
const DAY_DROP_PREFIX = "day:";

/** The column under the pointer wins; wide inbox cards would otherwise overlap a neighbouring day. */
const detectDropTarget: CollisionDetection = (detectionInput) => {
  const pointerCollisions = pointerWithin(detectionInput);
  return pointerCollisions.length ? pointerCollisions : rectIntersection(detectionInput);
};

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DRAG_DELAY_MS, tolerance: TOUCH_DRAG_TOLERANCE_PX } })
  );
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
      <WeekHeader board={board} actions={actions} locale={locale} copy={copy} />
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

function WeekHeader({ board, actions, locale, copy }: { board: WeekBoard; actions: WeekBoardActions; locale: string; copy: WeekCopy }): React.ReactElement {
  const currentWeekId = getIsoWeekId(board.today);
  const progressPercent = Math.round(board.summary.completionRate * 100);
  const progressLabel = copy.progress.replace("{done}", String(board.summary.done)).replace("{planned}", String(board.summary.planned));
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase text-accent">{copy.eyebrow} · {board.weekId}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">{formatWeekRange(board.days[0].date, board.days[6].date, locale)}</h1>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar value={progressPercent} className="w-40" />
          <span className="text-sm text-muted">{progressLabel}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <SecondaryButton type="button" aria-label={copy.previousWeek} onClick={() => actions.showWeek(board.previousWeekId)}><ChevronLeft className="h-4 w-4" /></SecondaryButton>
        {board.weekId !== currentWeekId ? <SecondaryButton type="button" onClick={() => actions.showWeek(currentWeekId)}>{copy.thisWeek}</SecondaryButton> : null}
        <SecondaryButton type="button" aria-label={copy.nextWeek} onClick={() => actions.showWeek(board.nextWeekId)}><ChevronRight className="h-4 w-4" /></SecondaryButton>
      </div>
    </header>
  );
}

function moveByOffset(board: WeekBoard, actions: WeekBoardActions, task: BoardTask, dayOffset: number): void {
  const destination = shiftDestination(board, task, dayOffset);
  if (destination) void actions.moveTask(task.id, destination);
}

function readDropDestination(dropId: string | number | undefined): TaskDestination | null {
  if (dropId === INBOX_DROP_ID) return { kind: "inbox" };
  if (typeof dropId === "string" && dropId.startsWith(DAY_DROP_PREFIX)) return { kind: "day", date: dropId.slice(DAY_DROP_PREFIX.length) };
  return null;
}
