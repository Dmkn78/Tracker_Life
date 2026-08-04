"use client";

import {
  closestCenter,
  DndContext,
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
  arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, GripVertical, PencilLine, Trash2 } from "lucide-react";
import { GhostButton, Pill, ProgressBar, SecondaryButton, Segmented, SegmentedButton, SoftPanel } from "@/components/ui";
import { formatDuration } from "@/components/DurationInput";
import type { TodoTask } from "@/features/todo/domain/todoTask";

export type { TodoTask } from "@/features/todo/domain/todoTask";

export function TodoList({
  tasks,
  onPatch,
  onEdit,
  onAdd,
  onDelete,
  onReorder
}: {
  tasks: TodoTask[];
  onPatch: (id: string, patch: Partial<TodoTask>) => void;
  onEdit: (task: TodoTask) => void;
  onAdd: () => void;
  onDelete: (task: TodoTask) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  if (tasks.length === 0) {
    return (
      <SoftPanel className="flex min-h-[280px] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-ink">No tasks match this filter.</p>
        <p className="mt-2 max-w-sm text-sm text-muted">Use Add to capture the next action, then keep this page focused on execution.</p>
        <SecondaryButton className="mt-5" onClick={onAdd}>
          Create task
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
  onPatch: (id: string, patch: Partial<TodoTask>) => void;
  onEdit: (task: TodoTask) => void;
  onDelete: (task: TodoTask) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { task } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TodoRow {...props} dragHandle={<GripVertical className="h-5 w-5" {...attributes} {...listeners} />} />
    </div>
  );
}

function TodoRow({
  task,
  onPatch,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  dragHandle
}: {
  task: TodoTask;
  onPatch: (id: string, patch: Partial<TodoTask>) => void;
  onEdit: (task: TodoTask) => void;
  onDelete: (task: TodoTask) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragHandle: React.ReactNode;
}) {
  const done = task.status === "done" || task.completionPercent >= 100;
  return (
    <SoftPanel className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 hidden cursor-grab touch-none text-muted hover:text-ink active:cursor-grabbing sm:block">
              {dragHandle}
            </span>
            <div className="mt-0.5 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-panel2/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 sm:h-6 sm:w-6"
                aria-label="Move task up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-panel2/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 sm:h-6 sm:w-6"
                aria-label="Move task down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                onPatch(task.id, {
                  completionPercent: done ? 0 : 100,
                  status: done ? "planned" : "done"
                })
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center text-muted transition hover:text-ink sm:mt-0.5 sm:h-5 sm:w-5"
              aria-label={done ? "Mark task as not done" : "Mark task as done"}
            >
              {done ? <CheckCircle2 className="h-5 w-5 text-good" /> : <Circle className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onEdit(task)} className="w-full text-left">
                <p className="truncate text-lg font-semibold text-ink">{task.title}</p>
                {task.description ? (
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted">{task.description}</p>
                ) : null}
              </button>
              <div className="mt-2 flex flex-wrap gap-2">
                {task.date ? <Pill>{task.date}</Pill> : <Pill className="text-muted">no date</Pill>}
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
                <Pill className={importanceTone(task.importance)}>{task.importance}</Pill>
                {task.productive ? <Pill>productive</Pill> : null}
                <Pill>{formatDuration(task.estimatedMinutes ?? 0)}</Pill>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>{statusLabel(task.status)}</span>
              <span>{task.completionPercent}%</span>
            </div>
            <ProgressBar value={task.completionPercent} />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[260px] lg:items-end">
          <Segmented className="w-full lg:w-auto">
            {[0, 50, 100].map((value) => (
              <SegmentedButton
                key={value}
                active={task.completionPercent === value}
                onClick={() =>
                  onPatch(task.id, {
                    completionPercent: value,
                    status: value === 100 ? "done" : value > 0 ? "in_progress" : "planned"
                  })
                }
                className="flex-1 lg:flex-none"
              >
                {value}%
              </SegmentedButton>
            ))}
          </Segmented>
          <div className="flex w-full gap-2 lg:justify-end">
            <Segmented className="flex-1 lg:flex-none">
              {(["planned", "in_progress", "done"] as const).map((status) => (
                <SegmentedButton
                  key={status}
                  active={task.status === status}
                  onClick={() => onPatch(task.id, { status, completionPercent: status === "done" ? 100 : task.completionPercent })}
                  className="flex-1 text-xs lg:flex-none"
                >
                  {status === "in_progress" ? "Doing" : status === "done" ? "Done" : "Plan"}
                </SegmentedButton>
              ))}
            </Segmented>
            <GhostButton onClick={() => onEdit(task)} className="min-h-9 min-w-9 rounded-2xl bg-panel2/50 px-3 ring-1 ring-line">
              <PencilLine className="h-4 w-4" />
            </GhostButton>
            <GhostButton
              onClick={() => onDelete(task)}
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

function importanceTone(importance: TodoTask["importance"]) {
  if (importance === "high") return "bg-warn/12 text-warn ring-warn/15";
  if (importance === "medium") return "bg-panel2/70 text-ink ring-line";
  return "bg-panel2/40 text-muted ring-line";
}

function statusLabel(status: TodoTask["status"]) {
  if (status === "in_progress") return "In progress";
  return status.replace("_", " ");
}
