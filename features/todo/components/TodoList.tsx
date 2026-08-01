"use client";

import { CheckCircle2, Circle, PencilLine } from "lucide-react";
import { GhostButton, Pill, ProgressBar, SecondaryButton, Segmented, SegmentedButton, SoftPanel } from "@/components/ui";
import { formatDuration } from "@/components/DurationInput";
import type { TodoTask } from "@/features/todo/domain/todoTask";

export type { TodoTask } from "@/features/todo/domain/todoTask";

export function TodoList({
  tasks,
  onPatch,
  onEdit,
  onAdd
}: {
  tasks: TodoTask[];
  onPatch: (id: string, patch: Partial<TodoTask>) => void;
  onEdit: (task: TodoTask) => void;
  onAdd: () => void;
}) {
  if (tasks.length === 0) {
    return (
      <SoftPanel className="flex min-h-[280px] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-slate-100">No tasks match this filter.</p>
        <p className="mt-2 max-w-sm text-sm text-slate-400">Use Add to capture the next action, then keep this page focused on execution.</p>
        <SecondaryButton className="mt-5" onClick={onAdd}>
          Create task
        </SecondaryButton>
      </SoftPanel>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const done = task.status === "done" || task.completionPercent >= 100;
        return (
          <SoftPanel key={task.id} className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onPatch(task.id, {
                        completionPercent: done ? 0 : 100,
                        status: done ? "planned" : "done"
                      })
                    }
                    className="mt-0.5 text-slate-400 transition hover:text-slate-100"
                    aria-label={done ? "Mark task as not done" : "Mark task as done"}
                  >
                    {done ? <CheckCircle2 className="h-5 w-5 text-good" /> : <Circle className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onEdit(task)} className="w-full text-left">
                      <p className="truncate text-lg font-semibold text-slate-50">{task.title}</p>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill>{task.date}</Pill>
                      {task.objectiveTitle ? <Pill className="bg-accent/12 text-accent ring-accent/15">{task.objectiveTitle}</Pill> : null}
                      <Pill className={importanceTone(task.importance)}>{task.importance}</Pill>
                      {task.productive ? <Pill>productive</Pill> : null}
                      <Pill>{formatDuration(task.estimatedMinutes ?? 0)}</Pill>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
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
                  <GhostButton onClick={() => onEdit(task)} className="min-h-9 rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8">
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </GhostButton>
                </div>
              </div>
            </div>
          </SoftPanel>
        );
      })}
    </div>
  );
}

function importanceTone(importance: TodoTask["importance"]) {
  if (importance === "high") return "bg-warn/12 text-warn ring-warn/15";
  if (importance === "medium") return "bg-white/[0.06] text-slate-200 ring-white/10";
  return "bg-white/[0.03] text-slate-400 ring-white/8";
}

function statusLabel(status: TodoTask["status"]) {
  if (status === "in_progress") return "In progress";
  return status.replace("_", " ");
}
