"use client";

import { DndContext, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { fetchGoals } from "@/features/goals/api/goalsApi";
import type { Goal } from "@/features/goals/domain/goal";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { useWeekBoard, type WeekBoardActions } from "@/features/week/application/useWeekBoard";
import { INBOX_DROP_ID, detectDropTarget, readDropDestination, useBoardSensors } from "@/features/week/components/boardDragAndDrop";
import { WeekHeader } from "@/features/week/components/WeekHeader";
import { WEEK_COPY } from "@/features/week/components/weekCopy";
import type { BoardTask, WeekBoard } from "@/features/week/domain/weekBoard";
import { getIsoWeekId } from "@/lib/dates";
import { groupBacklogByGoal, selectPlannableDays } from "../domain/planningBacklog";
import { PlanningDayZone } from "./PlanningDayZone";
import { PlanningTaskCard, type PlanningTaskActions } from "./PlanningTaskCard";
import { PLANNING_COPY, type PlanningCopy } from "./planningCopy";

/** Plan ahead: a list of tasks on one side, the days of the chosen week on the other. */
export function PlanningBoardView(): React.ReactElement {
  const { locale } = useLocale();
  const copy = PLANNING_COPY[locale];
  const weekCopy = WEEK_COPY[locale];
  const { state, actionError, actions } = useWeekBoard();

  if (state.kind === "loading") return <p className="text-sm text-muted">{weekCopy.loading}</p>;
  if (state.kind === "failed") {
    return (
      <div className="grid gap-3">
        <p role="alert" className="text-sm text-risk">{weekCopy.failed} {state.message}</p>
        <SecondaryButton type="button" onClick={() => actions.showWeek(getIsoWeekId())}>{weekCopy.retry}</SecondaryButton>
      </div>
    );
  }
  const board = state.board;
  const taskActions: PlanningTaskActions = {
    planOn: (task, date) => void actions.moveTask(task.id, { kind: "day", date }),
    unplan: (task) => void actions.moveTask(task.id, { kind: "inbox" }),
    toggle: (task) => void actions.toggleTask(task),
    remove: (task) => { if (window.confirm(copy.confirmRemove)) void actions.removeTask(task); }
  };
  return (
    <div className="grid gap-5">
      <WeekHeader board={board} eyebrow={copy.eyebrow} locale={locale} copy={weekCopy} onShowWeek={actions.showWeek} />
      <p className="max-w-3xl text-sm text-muted">{copy.hint}</p>
      {actionError ? <p role="alert" className="text-sm text-risk">{actionError}</p> : null}
      <PlanningBoard board={board} actions={actions} taskActions={taskActions} locale={locale} copy={copy} />
      <Link href="/objectives/forecasts" className="focus-ring w-fit text-sm text-accent">{copy.forecasts} →</Link>
    </div>
  );
}

function PlanningBoard({ board, actions, taskActions, locale, copy }: {
  board: WeekBoard;
  actions: WeekBoardActions;
  taskActions: PlanningTaskActions;
  locale: string;
  copy: PlanningCopy;
}): React.ReactElement {
  const sensors = useBoardSensors();

  function handleDragEnd(event: DragEndEvent): void {
    const destination = readDropDestination(event.over?.id);
    if (destination) void actions.moveTask(String(event.active.id), destination);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={detectDropTarget} onDragEnd={handleDragEnd}>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <BacklogPanel tasks={board.inbox} days={selectPlannableDays(board.days, board.today)} locale={locale} copy={copy} taskActions={taskActions} onAdd={(title, goalId) => actions.addTask(title, { kind: "inbox" }, goalId)} />
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {board.days.map((day) => (
            <PlanningDayZone key={day.date} day={day} days={selectPlannableDays(board.days, board.today)} isToday={day.date === board.today} locale={locale} copy={copy} actions={taskActions} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function BacklogPanel({ tasks, days, locale, copy, taskActions, onAdd }: {
  tasks: BoardTask[];
  days: WeekBoard["days"];
  locale: string;
  copy: PlanningCopy;
  taskActions: PlanningTaskActions;
  onAdd: (title: string, goalId: string | null) => Promise<void>;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: INBOX_DROP_ID });
  const groups = groupBacklogByGoal(tasks);
  return (
    <section ref={setNodeRef} aria-label={copy.backlog} className={`grid gap-3 rounded-[22px] p-3 ring-1 transition lg:sticky lg:top-4 ${isOver ? "bg-accent/10 ring-accent" : "bg-panel2/50 ring-line"}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Inbox className="h-4 w-4" />{copy.backlog} <span className="font-normal text-muted">{tasks.length}</span></h2>
      <BacklogAddForm copy={copy} onAdd={onAdd} />
      {!tasks.length ? <p className="text-sm text-muted">{copy.backlogEmpty}</p> : null}
      {groups.map((group) => (
        <div key={group.key} className="grid gap-1.5">
          <p className="text-xs font-semibold uppercase text-muted">{group.title ?? copy.noGoal}</p>
          <ul className="grid gap-1.5">
            {group.tasks.map((task) => <PlanningTaskCard key={task.id} task={task} days={days} locale={locale} copy={copy} actions={taskActions} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}

function BacklogAddForm({ copy, onAdd }: { copy: PlanningCopy; onAdd: (title: string, goalId: string | null) => Promise<void> }): React.ReactElement {
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGoals(controller.signal).then((loadedGoals) => setGoals(loadedGoals.filter((goal) => !goal.isDone))).catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setTitle("");
    await onAdd(trimmedTitle, goalId || null);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-2">
      <div className="flex gap-2">
        <input aria-label={copy.addPlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.addPlaceholder} className="focus-ring min-h-10 min-w-0 flex-1 rounded-xl bg-panel px-3 text-sm text-ink ring-1 ring-line placeholder:text-muted/70" />
        <PrimaryButton type="submit" disabled={!title.trim()} aria-label={copy.add}><Plus className="h-4 w-4" /></PrimaryButton>
      </div>
      {goals.length ? (
        <select aria-label={copy.goal} value={goalId} onChange={(event) => setGoalId(event.target.value)} className="focus-ring min-h-9 rounded-xl bg-panel px-2 text-xs text-muted ring-1 ring-line">
          <option value="">{copy.goal} : {copy.noGoalOption}</option>
          {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
        </select>
      ) : null}
    </form>
  );
}
