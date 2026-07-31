"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DurationInput } from "@/components/DurationInput";
import { TodoList, type TodoTask } from "@/components/TodoList";
import {
  Drawer,
  FieldLabel,
  Metric,
  PrimaryButton,
  SelectInput,
  SecondaryButton,
  SectionHeader,
  Segmented,
  SegmentedButton,
  SoftPanel,
  TextArea,
  TextInput
} from "@/components/ui";
import { addDays, formatDisplayDate } from "@/lib/dates";

type TaskDraft = {
  id?: string;
  title: string;
  date: string;
  objectiveId: string;
  importance: TodoTask["importance"];
  productive: boolean;
  estimatedMinutes: number;
  completionPercent: number;
  status: TodoTask["status"];
};

const draftForDate = (date: string): TaskDraft => ({
  title: "",
  date,
  objectiveId: "",
  importance: "medium",
  productive: true,
  estimatedMinutes: 0,
  completionPercent: 0,
  status: "planned"
});

export function TodoClient({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [scope, setScope] = useState<"today" | "tomorrow" | "all">("today");
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [objectiveOptions, setObjectiveOptions] = useState<Array<{ id: string; title: string; horizon: string }>>([]);
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; draft: TaskDraft } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(nextDate = date, nextScope = scope) {
    const params = new URLSearchParams({ scope: nextScope, date: nextDate });
    const data = await fetch(`/api/tasks?${params.toString()}`).then((response) => response.json());
    setTasks(data.tasks);
  }

  async function loadObjectives() {
    const data = await fetch("/api/objectives").then((response) => response.json());
    setObjectiveOptions(data.objectives ?? []);
  }

  useEffect(() => {
    load();
  }, [date, scope]);

  useEffect(() => {
    loadObjectives();
  }, []);

  function changeScope(nextScope: "today" | "tomorrow" | "all") {
    setScope(nextScope);
    if (nextScope === "today") setDate(today);
    if (nextScope === "tomorrow") setDate(addDays(today, 1));
  }

  function openCreate() {
    setDrawer({ mode: "create", draft: draftForDate(date) });
  }

  function openEdit(task: TodoTask) {
    setDrawer({
      mode: "edit",
        draft: {
          id: task.id,
          title: task.title,
          date: task.date,
          objectiveId: task.objectiveId ?? "",
          importance: task.importance,
          productive: task.productive,
          estimatedMinutes: task.estimatedMinutes ?? 0,
        completionPercent: task.completionPercent,
        status: task.status
      }
    });
  }

  async function saveTask(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer) return;
    const titles = splitTaskLines(drawer.draft.title);
    if (titles.length === 0) return;
    setSaving(true);
    const isEdit = drawer.mode === "edit" && drawer.draft.id;
    const response = await fetch("/api/tasks", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: drawer.draft.id, ...drawer.draft } : { ...drawer.draft, titles })
    });
    const data = await response.json();
    if (isEdit) {
      setTasks((current) => current.map((task) => (task.id === data.task.id ? data.task : task)));
    } else {
      setTasks((current) => [...data.tasks, ...current]);
    }
    setSaving(false);
    setDrawer(null);
  }

  async function patchTask(id: string, patch: Partial<TodoTask>) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });
    const data = await response.json();
    setTasks((current) => current.map((task) => (task.id === id ? data.task : task)));
  }

  const completed = tasks.filter((task) => task.status === "done" || task.completionPercent >= 100).length;
  const averageDone = tasks.length === 0 ? 0 : Math.round(tasks.reduce((sum, task) => sum + task.completionPercent, 0) / tasks.length);
  const totalEstimatedMinutes = tasks.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={scope === "all" ? "All tasks" : formatDisplayDate(date)}
        title="To-do"
        detail="Keep the page focused on what needs doing. Creation and edits live in a side panel."
        action={
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add
            </PrimaryButton>
          </div>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented>
          {(["today", "tomorrow", "all"] as const).map((item) => (
            <SegmentedButton key={item} active={scope === item} onClick={() => changeScope(item)}>
              {item}
            </SegmentedButton>
          ))}
        </Segmented>
        <div className="flex items-center gap-2">
          <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-auto min-w-[170px]" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Tasks" value={String(tasks.length)} />
        <Metric label="Done" value={`${completed}/${tasks.length || 0}`} tone={completed > 0 ? "good" : "neutral"} />
        <Metric label="Planned time" value={formatMinutes(totalEstimatedMinutes)} detail={`Average done ${averageDone}%`} />
      </div>

      <SoftPanel className="p-3">
        <TodoList tasks={tasks} onPatch={patchTask} onEdit={openEdit} onAdd={openCreate} />
      </SoftPanel>

      <Drawer
        open={drawer != null}
        title={drawer?.mode === "edit" ? "Edit task" : "Add task"}
        description={drawer?.mode === "edit" ? "Keep the task small, concrete, and easy to execute." : "One line = one task. Paste a short list if you want to capture several actions at once."}
        onClose={() => setDrawer(null)}
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setDrawer(null)}>Cancel</SecondaryButton>
            <PrimaryButton form="task-editor-form" type="submit" disabled={splitTaskLines(drawer?.draft.title ?? "").length === 0 || saving}>
              {saving ? "Saving..." : drawer?.mode === "edit" ? "Save task" : "Create task(s)"}
            </PrimaryButton>
          </div>
        }
      >
        {drawer ? (
          <form id="task-editor-form" onSubmit={saveTask} className="space-y-4">
            <div>
              <FieldLabel>Task</FieldLabel>
              {drawer.mode === "edit" ? (
                <TextInput
                  value={drawer.draft.title}
                  onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)}
                  className="mt-2"
                  placeholder="One clear action"
                />
              ) : (
                <>
                  <TextArea
                    value={drawer.draft.title}
                    onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)}
                    className="mt-2 min-h-[132px]"
                    placeholder={"One clear action\nAnother task\nAnother task"}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {splitTaskLines(drawer.draft.title).length} task{splitTaskLines(drawer.draft.title).length > 1 ? "s" : ""} ready to create.
                  </p>
                </>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Date</FieldLabel>
                <TextInput
                  type="date"
                  value={drawer.draft.date}
                  onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, date: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>Objective / project</FieldLabel>
                <SelectInput
                  value={drawer.draft.objectiveId}
                  onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, objectiveId: event.target.value } } : current)}
                  className="mt-2 w-full"
                >
                  <option value="">No linked objective</option>
                  {objectiveOptions.map((objective) => (
                    <option key={objective.id} value={objective.id}>
                      {objective.title} · {objective.horizon}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <DurationInput
                label="Estimated time"
                value={drawer.draft.estimatedMinutes}
                onChange={(estimatedMinutes) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, estimatedMinutes } } : current)}
                showStored={false}
              />
            </div>
            <div>
              <FieldLabel>Importance</FieldLabel>
              <div className="mt-2">
                <Segmented className="w-full">
                  {(["low", "medium", "high"] as const).map((level) => (
                    <SegmentedButton
                      key={level}
                      active={drawer.draft.importance === level}
                      onClick={() => setDrawer((current) => current ? { ...current, draft: { ...current.draft, importance: level } } : current)}
                      type="button"
                      className="flex-1"
                    >
                      {level}
                    </SegmentedButton>
                  ))}
                </Segmented>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Status</FieldLabel>
                <div className="mt-2">
                  <Segmented className="w-full">
                    {(["planned", "in_progress", "done"] as const).map((status) => (
                      <SegmentedButton
                        key={status}
                        active={drawer.draft.status === status}
                        onClick={() =>
                          setDrawer((current) =>
                            current
                              ? {
                                  ...current,
                                  draft: {
                                    ...current.draft,
                                    status,
                                    completionPercent: status === "done" ? 100 : current.draft.completionPercent
                                  }
                                }
                              : current
                          )
                        }
                        type="button"
                        className="flex-1"
                      >
                        {status === "in_progress" ? "Doing" : status === "done" ? "Done" : "Plan"}
                      </SegmentedButton>
                    ))}
                  </Segmented>
                </div>
              </div>
              <div>
                <FieldLabel>Progress</FieldLabel>
                <div className="mt-2">
                  <Segmented className="w-full">
                    {[0, 25, 50, 75, 100].map((value) => (
                      <SegmentedButton
                        key={value}
                        active={drawer.draft.completionPercent === value}
                        onClick={() =>
                          setDrawer((current) =>
                            current
                              ? {
                                  ...current,
                                  draft: {
                                    ...current.draft,
                                    completionPercent: value,
                                    status: value === 100 ? "done" : value > 0 ? "in_progress" : "planned"
                                  }
                                }
                              : current
                          )
                        }
                        type="button"
                        className="flex-1 text-xs"
                      >
                        {value}%
                      </SegmentedButton>
                    ))}
                  </Segmented>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-[20px] bg-white/[0.035] px-4 py-3 ring-1 ring-white/8 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={drawer.draft.productive}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, productive: event.target.checked } } : current)}
                className="h-4 w-4 accent-accent"
              />
              Productive task
            </label>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

function splitTaskLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
