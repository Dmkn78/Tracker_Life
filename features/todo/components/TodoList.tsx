"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, GripVertical, PencilLine, Trash2 } from "lucide-react";
import { GhostButton, Pill, ProgressBar, SecondaryButton, Segmented, SegmentedButton, SoftPanel } from "@/components/ui";
import { formatDuration } from "@/components/DurationInput";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { TranslationKey } from "@/features/interface/localization/messages";
import type { TaskWritePayload } from "@/features/todo/api/todoApi";
import { completionPercentForTodoStatus } from "@/features/todo/domain/todoTask";
import type { TodoImportance, TodoStatus, TodoTask } from "@/features/todo/domain/todoTask";

export type { TodoTask } from "@/features/todo/domain/todoTask";

const QUICK_STATUS_OPTIONS = ["planned", "in_progress", "done", "not_done"] as const;
const STATUS_LABEL_KEYS: Record<TodoStatus, TranslationKey> = {
  planned: "todo.status.planned",
  in_progress: "todo.status.inProgress",
  done: "todo.status.done",
  not_done: "todo.status.notDone",
  postponed: "todo.status.postponed",
  cancelled: "todo.status.cancelled"
};
const IMPORTANCE_LABEL_KEYS: Record<TodoImportance, TranslationKey> = {
  low: "todo.importance.low",
  medium: "todo.importance.medium",
  high: "todo.importance.high"
};

export function TodoList({
  tasks,
  onPatch,
  onEdit,
  onAdd,
  onDelete,
  onLog,
  onReorder
}: {
  tasks: TodoTask[];
  onPatch: (id: string, patch: TaskWritePayload) => void;
  onEdit: (task: TodoTask) => void;
  onAdd: () => void;
  onDelete: (task: TodoTask) => void;
  onLog: (task: TodoTask) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const { translate } = useLocale();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (tasks.length === 0) {
    return (
      <SoftPanel className="flex min-h-[280px] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-ink">{translate("todo.empty")}</p>
        <p className="mt-2 max-w-sm text-sm text-muted">{translate("todo.emptyDetail")}</p>
        <SecondaryButton className="mt-5" onClick={onAdd}>
          {translate("todo.createTask")}
        </SecondaryButton>
      </SoftPanel>
    );
  }

  function moveBy(taskId: string, offset: number) {
    const index = tasks.findIndex((task) => task.id === taskId);
    const targetIndex = index + offset;
    if (index === -1 || targetIndex < 0 || targetIndex >= tasks.length) return;
    onReorder(arrayMove(tasks, index, targetIndex).map((task) => task.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((task) => task.id === active.id);
    const newIndex = tasks.findIndex((task) => task.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(tasks, oldIndex, newIndex).map((task) => task.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <SortableTodoRow
              key={task.id}
              task={task}
              onPatch={onPatch}
              onEdit={onEdit}
              onDelete={onDelete}
              onLog={onLog}
              onMoveUp={() => moveBy(task.id, -1)}
              onMoveDown={() => moveBy(task.id, 1)}
              canMoveUp={index > 0}
              canMoveDown={index < tasks.length - 1}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTodoRow(props: {
  task: TodoTask;
  onPatch: (id: string, patch: TaskWritePayload) => void;
  onEdit: (task: TodoTask) => void;
  onDelete: (task: TodoTask) => void;
  onLog: (task: TodoTask) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { task } = props;
  const { translate } = useLocale();
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TodoRow
        {...props}
        dragHandle={(
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="focus-ring inline-flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted transition hover:bg-panel2/60 hover:text-ink active:cursor-grabbing sm:h-8 sm:w-8"
            {...attributes}
            {...listeners}
            aria-label={translate("todo.dragTask")}
          >
            <GripVertical aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
      />
    </div>
  );
}

function TodoRow({
  task,
  onPatch,
  onEdit,
  onDelete,
  onLog,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  dragHandle
}: {
  task: TodoTask;
  onPatch: (id: string, patch: TaskWritePayload) => void;
  onEdit: (task: TodoTask) => void;
  onDelete: (task: TodoTask) => void;
  onLog: (task: TodoTask) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragHandle: React.ReactNode;
}) {
  const { translate } = useLocale();
  const done = task.status === "done" || task.completionPercent >= 100;
  return (
    <SoftPanel className="p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            {dragHandle}
            <div className="mt-0.5 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-panel2/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 sm:h-6 sm:w-6"
                aria-label={translate("todo.moveUp")}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-panel2/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 sm:h-6 sm:w-6"
                aria-label={translate("todo.moveDown")}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                onPatch(task.id, {
                  completionPercent: done ? 0 : 100,
                  status: done ? "planned" : "done",
                  notDoneReason: null
                })
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center text-muted transition hover:text-ink sm:mt-0.5 sm:h-5 sm:w-5"
              aria-label={translate(done ? "todo.markPlanned" : "todo.markDone")}
            >
              {done ? <CheckCircle2 className="h-5 w-5 text-good" /> : <Circle className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onEdit(task)} className="w-full text-left">
                <p className="whitespace-normal break-words text-lg font-semibold text-ink">{task.title}</p>
                {task.description ? (
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted">{task.description}</p>
                ) : null}
                {task.status === "not_done" && task.notDoneReason ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-risk">
                    {translate("todo.notDoneReasonLabel", { reason: task.notDoneReason })}
                  </p>
                ) : null}
              </button>
              <div className="mt-2 flex flex-wrap gap-2">
                {task.date ? <Pill>{task.date}</Pill> : <Pill className="text-muted">{translate("todo.noDate")}</Pill>}
                {task.startTime ? <Pill>{task.startTime}{task.endTime ? `–${task.endTime}` : ""}</Pill> : null}
                {task.objectiveTitle ? <Pill className="bg-accent/12 text-accent ring-accent/15">{task.objectiveTitle}</Pill> : null}
                {task.companyName ? (
                  <Pill className="ring-line" style={{ backgroundColor: `${task.companyColor}22`, color: task.companyColor ?? undefined }}>
                    {task.companyName}
                  </Pill>
                ) : null}
                {task.tags.map((tag) => (
                  <Pill key={tag.id} style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>
                    {tag.name}
                  </Pill>
                ))}
                <Pill className={importanceTone(task.importance)}>{translate(IMPORTANCE_LABEL_KEYS[task.importance])}</Pill>
                {task.productive ? <Pill>{translate("todo.productive")}</Pill> : null}
                <Pill>{formatDuration(task.estimatedMinutes ?? 0)}</Pill>
                {task.workSessions?.length ? <Pill>{formatDuration(task.workSessions.reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0))} · {translate("todo.logExecution")}</Pill> : null}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>{translate(STATUS_LABEL_KEYS[task.status])}</span>
              <span>{task.completionPercent}%</span>
            </div>
            <ProgressBar value={task.completionPercent} />
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 xl:w-[400px] xl:shrink-0 xl:items-end">
          <Segmented aria-label={translate("todo.progressOptions")} className="w-full xl:w-auto">
            {[0, 50, 100].map((value) => (
              <SegmentedButton
                key={value}
                active={task.completionPercent === value}
                onClick={() =>
                  onPatch(task.id, {
                    completionPercent: value,
                    status: value === 100 ? "done" : value > 0 ? "in_progress" : "planned",
                    notDoneReason: null
                  })
                }
                className="flex-1 xl:flex-none"
              >
                {value}%
              </SegmentedButton>
            ))}
          </Segmented>
          <div className="flex w-full flex-wrap gap-2 xl:justify-end">
            <SecondaryButton disabled={task.status === "cancelled"} onClick={() => onLog(task)}>{translate("todo.logExecution")}</SecondaryButton>
            <Segmented aria-label={translate("todo.statusOptions")} className="w-full sm:w-auto sm:flex-1 xl:flex-none">
              {QUICK_STATUS_OPTIONS.map((status) => (
                <SegmentedButton
                  key={status}
                  active={task.status === status}
                  onClick={() => onPatch(task.id, {
                    status,
                    completionPercent: completionPercentForTodoStatus(task.completionPercent, status),
                    notDoneReason: status === "not_done" ? task.notDoneReason : null
                  })}
                  className="min-w-[88px] flex-1 text-xs xl:flex-none"
                >
                  {translate(STATUS_LABEL_KEYS[status])}
                </SegmentedButton>
              ))}
            </Segmented>
            <GhostButton aria-label={translate("todo.edit")} onClick={() => onEdit(task)} className="min-h-9 min-w-9 rounded-2xl bg-panel2/50 px-3 ring-1 ring-line">
              <PencilLine className="h-4 w-4" />
            </GhostButton>
            <GhostButton
              onClick={() => onDelete(task)}
              aria-label={translate("todo.delete")}
              className="min-h-9 min-w-9 rounded-2xl bg-panel2/50 px-3 text-risk ring-1 ring-line hover:text-risk"
            >
              <Trash2 className="h-4 w-4" />
            </GhostButton>
          </div>
        </div>
      </div>
    </SoftPanel>
  );
}

function importanceTone(importance: TodoTask["importance"]): string {
  if (importance === "high") return "bg-warn/12 text-warn ring-warn/15";
  if (importance === "medium") return "bg-panel2/70 text-ink ring-line";
  return "bg-panel2/40 text-muted ring-line";
}
