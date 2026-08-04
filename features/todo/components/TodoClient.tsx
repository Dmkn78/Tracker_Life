"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DurationInput } from "@/components/DurationInput";
import { CompanyField, TagsField } from "@/components/TagCompanyFields";
import { TodoList } from "@/features/todo/components/TodoList";
import {
  Drawer,
  FieldLabel,
  GhostButton,
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
import {
  createTodoTasks,
  deleteTodoTask,
  listObjectiveOptions,
  listTodoTasks,
  reorderTodoTasks,
  updateTodoTask
} from "@/features/todo/api/todoApi";
import { listCompanies } from "@/features/shared/api/companiesApi";
import { listTags } from "@/features/shared/api/tagsApi";
import type { Company, Tag } from "@/features/shared/domain/tagCompany";
import {
  emptyTodoTaskFields,
  type ObjectiveOption,
  type TodoScope,
  type TodoTask,
  type TodoTaskFields,
  type TodoTaskRow
} from "@/features/todo/domain/todoTask";
import { addDays, formatDisplayDate } from "@/lib/dates";
import { ApiError } from "@/lib/http/apiClient";

type DrawerState =
  | { kind: "edit"; id: string; draft: TodoTaskFields }
  | { kind: "create"; createMode: "single" | "multi"; single: TodoTaskFields; rows: TodoTaskRow[] };

let rowKeySeed = 0;
function newRow(date: string): TodoTaskRow {
  rowKeySeed += 1;
  return { ...emptyTodoTaskFields(date), key: `row-${rowKeySeed}`, enabled: true };
}

export function TodoClient({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [scope, setScope] = useState<TodoScope>("today");
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [objectiveOptions, setObjectiveOptions] = useState<ObjectiveOption[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [objectiveOptionsError, setObjectiveOptionsError] = useState<string | null>(null);

  useEffect(() => {
    const requestController = new AbortController();
    setPageError(null);
    void listTodoTasks({ date, scope, signal: requestController.signal })
      .then(setTasks)
      .catch((error: unknown) => {
        if (!requestController.signal.aborted) {
          setPageError(readApiErrorMessage(error, "Unable to load tasks."));
        }
      });
    return () => requestController.abort();
  }, [date, scope]);

  useEffect(() => {
    const requestController = new AbortController();
    setObjectiveOptionsError(null);
    void listObjectiveOptions(requestController.signal)
      .then(setObjectiveOptions)
      .catch((error: unknown) => {
        if (!requestController.signal.aborted) {
          setObjectiveOptionsError(readApiErrorMessage(error, "Unable to load objective options."));
        }
      });
    void listCompanies(requestController.signal)
      .then(setCompanies)
      .catch(() => undefined);
    void listTags(requestController.signal)
      .then(setTags)
      .catch(() => undefined);
    return () => requestController.abort();
  }, []);

  function changeScope(nextScope: TodoScope) {
    setScope(nextScope);
    if (nextScope === "today") setDate(today);
    if (nextScope === "tomorrow") setDate(addDays(today, 1));
  }

  function openCreate() {
    setDrawerError(null);
    setDrawer({
      kind: "create",
      createMode: "single",
      single: emptyTodoTaskFields(date),
      rows: [newRow(date), newRow(date)]
    });
  }

  function openEdit(task: TodoTask) {
    setDrawerError(null);
    setDrawer({
      kind: "edit",
      id: task.id,
      draft: {
        title: task.title,
        description: task.description ?? "",
        date: task.date ?? "",
        startTime: task.startTime ?? "",
        endTime: task.endTime ?? "",
        objectiveId: task.objectiveId ?? "",
        companyName: task.companyName ?? "",
        tagNames: task.tags.map((tag) => tag.name),
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
    setDrawerError(null);

    if (drawer.kind === "edit") {
      setSaving(true);
      try {
        const updatedTask = await updateTodoTask(toUpdatePayload(drawer.id, drawer.draft));
        setTasks((current) => current.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
        setDrawer(null);
      } catch (error: unknown) {
        setDrawerError(readApiErrorMessage(error, "Unable to save the task."));
      } finally {
        setSaving(false);
      }
      return;
    }

    const items =
      drawer.createMode === "single"
        ? drawer.single.title.trim()
          ? [toCreateItemPayload(drawer.single)]
          : []
        : drawer.rows
            .filter((row) => row.enabled && row.title.trim())
            .map((row) => toCreateItemPayload(row));

    if (items.length === 0) {
      setDrawerError(
        drawer.createMode === "single" ? "Add a task name." : "Enable at least one row with a name."
      );
      return;
    }

    setSaving(true);
    try {
      const createdTasks = await createTodoTasks({ items });
      setTasks((current) => [...createdTasks, ...current]);
      setDrawer(null);
    } catch (error: unknown) {
      setDrawerError(readApiErrorMessage(error, "Unable to save the task(s)."));
    } finally {
      setSaving(false);
    }
  }

  async function patchTask(id: string, patch: Partial<TodoTask>) {
    const previousTask = tasks.find((task) => task.id === id);
    setPageError(null);
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    try {
      const updatedTask = await updateTodoTask({ id, ...patch });
      setTasks((current) => current.map((task) => (task.id === id ? updatedTask : task)));
    } catch (error: unknown) {
      if (previousTask) {
        setTasks((current) => current.map((task) => (task.id === id ? previousTask : task)));
      }
      setPageError(readApiErrorMessage(error, "Unable to update the task."));
    }
  }

  async function reorderTasks(orderedIds: string[]) {
    const previousTasks = tasks;
    const reordered = orderedIds
      .map((id) => tasks.find((task) => task.id === id))
      .filter((task): task is TodoTask => Boolean(task));
    setPageError(null);
    setTasks(reordered);
    try {
      await reorderTodoTasks(orderedIds);
    } catch (error: unknown) {
      setTasks(previousTasks);
      setPageError(readApiErrorMessage(error, "Unable to reorder tasks."));
    }
  }

  async function deleteTask(task: TodoTask) {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${task.title}"?`)) return;
    const previousTasks = tasks;
    setPageError(null);
    setTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await deleteTodoTask(task.id);
    } catch (error: unknown) {
      setTasks(previousTasks);
      setPageError(readApiErrorMessage(error, "Unable to delete the task."));
    }
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

      {pageError ? (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {pageError}
        </p>
      ) : null}

      <SoftPanel className="p-3">
        <TodoList tasks={tasks} onPatch={patchTask} onEdit={openEdit} onAdd={openCreate} onDelete={deleteTask} onReorder={reorderTasks} />
      </SoftPanel>

      <Drawer
        open={drawer != null}
        title={drawer?.kind === "edit" ? "Edit task" : "Add task"}
        description={
          drawer?.kind === "edit"
            ? "Keep the task small, concrete, and easy to execute."
            : "Create one task with full detail, or switch to multiple to capture several at once."
        }
        onClose={() => setDrawer(null)}
        width="lg"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setDrawer(null)}>Cancel</SecondaryButton>
            <PrimaryButton form="task-editor-form" type="submit" disabled={saving}>
              {saving ? "Saving..." : drawer?.kind === "edit" ? "Save task" : "Create task(s)"}
            </PrimaryButton>
          </div>
        }
      >
        {drawer ? (
          <form id="task-editor-form" onSubmit={saveTask} className="space-y-4">
            {drawerError || objectiveOptionsError ? (
              <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {drawerError ?? objectiveOptionsError}
              </p>
            ) : null}

            {drawer.kind === "create" ? (
              <Segmented className="w-full">
                <SegmentedButton
                  type="button"
                  className="flex-1"
                  active={drawer.createMode === "single"}
                  onClick={() => setDrawer((current) => (current?.kind === "create" ? { ...current, createMode: "single" } : current))}
                >
                  Single task
                </SegmentedButton>
                <SegmentedButton
                  type="button"
                  className="flex-1"
                  active={drawer.createMode === "multi"}
                  onClick={() => setDrawer((current) => (current?.kind === "create" ? { ...current, createMode: "multi" } : current))}
                >
                  Create multiple
                </SegmentedButton>
              </Segmented>
            ) : null}

            {drawer.kind === "edit" ? (
              <TaskFieldsEditor
                fields={drawer.draft}
                onChange={(fields) => setDrawer((current) => (current?.kind === "edit" ? { ...current, draft: fields } : current))}
                objectiveOptions={objectiveOptions}
                companies={companies}
                tags={tags}
                showStatus
              />
            ) : drawer.createMode === "single" ? (
              <TaskFieldsEditor
                fields={drawer.single}
                onChange={(fields) => setDrawer((current) => (current?.kind === "create" ? { ...current, single: fields } : current))}
                objectiveOptions={objectiveOptions}
                companies={companies}
                tags={tags}
                showStatus
              />
            ) : (
              <div className="space-y-3">
                {drawer.rows.map((row) => (
                  <MultiTaskRowEditor
                    key={row.key}
                    row={row}
                    onChange={(next) =>
                      setDrawer((current) =>
                        current?.kind === "create"
                          ? { ...current, rows: current.rows.map((item) => (item.key === row.key ? next : item)) }
                          : current
                      )
                    }
                    onRemove={() =>
                      setDrawer((current) =>
                        current?.kind === "create"
                          ? { ...current, rows: current.rows.filter((item) => item.key !== row.key) }
                          : current
                      )
                    }
                    companies={companies}
                    tags={tags}
                  />
                ))}
                <SecondaryButton
                  type="button"
                  onClick={() =>
                    setDrawer((current) =>
                      current?.kind === "create" ? { ...current, rows: [...current.rows, newRow(date)] } : current
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add row
                </SecondaryButton>
              </div>
            )}
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function TaskFieldsEditor({
  fields,
  onChange,
  objectiveOptions,
  companies,
  tags,
  showStatus
}: {
  fields: TodoTaskFields;
  onChange: (fields: TodoTaskFields) => void;
  objectiveOptions: ObjectiveOption[];
  companies: Company[];
  tags: Tag[];
  showStatus: boolean;
}) {
  function set<K extends keyof TodoTaskFields>(key: K, value: TodoTaskFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Name</FieldLabel>
        <TextInput
          value={fields.title}
          onChange={(event) => set("title", event.target.value)}
          className="mt-2"
          placeholder="One clear action"
          required
        />
      </div>
      <div>
        <FieldLabel>Description (optional)</FieldLabel>
        <TextArea
          value={fields.description}
          onChange={(event) => set("description", event.target.value)}
          className="mt-2 min-h-[96px]"
          placeholder="Extra context, notes, or steps for this one task"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <FieldLabel>Date (optional)</FieldLabel>
          <TextInput type="date" value={fields.date} onChange={(event) => set("date", event.target.value)} className="mt-2" />
        </div>
        <div>
          <FieldLabel>Start time (optional)</FieldLabel>
          <TextInput type="time" value={fields.startTime} onChange={(event) => set("startTime", event.target.value)} className="mt-2" />
        </div>
        <div>
          <FieldLabel>End time (optional)</FieldLabel>
          <TextInput type="time" value={fields.endTime} onChange={(event) => set("endTime", event.target.value)} className="mt-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>Objective / project</FieldLabel>
          <SelectInput value={fields.objectiveId} onChange={(event) => set("objectiveId", event.target.value)} className="mt-2 w-full">
            <option value="">No linked objective</option>
            {objectiveOptions.map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.title} · {objective.horizon}
              </option>
            ))}
          </SelectInput>
        </div>
        <DurationInput
          label="Estimated time (optional)"
          value={fields.estimatedMinutes}
          onChange={(estimatedMinutes) => set("estimatedMinutes", estimatedMinutes)}
          showStored={false}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CompanyField value={fields.companyName} onChange={(value) => set("companyName", value)} companies={companies} />
        <TagsField value={fields.tagNames} onChange={(value) => set("tagNames", value)} tags={tags} />
      </div>
      <div>
        <FieldLabel>Importance</FieldLabel>
        <div className="mt-2">
          <Segmented className="w-full">
            {(["low", "medium", "high"] as const).map((level) => (
              <SegmentedButton key={level} active={fields.importance === level} onClick={() => set("importance", level)} type="button" className="flex-1">
                {level}
              </SegmentedButton>
            ))}
          </Segmented>
        </div>
      </div>
      {showStatus ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>Status</FieldLabel>
            <div className="mt-2">
              <Segmented className="w-full">
                {(["planned", "in_progress", "done"] as const).map((status) => (
                  <SegmentedButton
                    key={status}
                    active={fields.status === status}
                    onClick={() =>
                      onChange({ ...fields, status, completionPercent: status === "done" ? 100 : fields.completionPercent })
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
                    active={fields.completionPercent === value}
                    onClick={() =>
                      onChange({
                        ...fields,
                        completionPercent: value,
                        status: value === 100 ? "done" : value > 0 ? "in_progress" : "planned"
                      })
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
      ) : null}
      <label className="flex items-center gap-3 rounded-[20px] bg-panel2/60 px-4 py-3 ring-1 ring-line text-sm text-ink">
        <input
          type="checkbox"
          checked={fields.productive}
          onChange={(event) => set("productive", event.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Productive task
      </label>
    </div>
  );
}

function MultiTaskRowEditor({
  row,
  onChange,
  onRemove,
  companies,
  tags
}: {
  row: TodoTaskRow;
  onChange: (row: TodoTaskRow) => void;
  onRemove: () => void;
  companies: Company[];
  tags: Tag[];
}) {
  function set<K extends keyof TodoTaskRow>(key: K, value: TodoTaskRow[K]) {
    onChange({ ...row, [key]: value });
  }

  return (
    <SoftPanel className={`space-y-3 p-4 transition ${row.enabled ? "" : "opacity-50"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={row.enabled}
          onChange={(event) => set("enabled", event.target.checked)}
          className="mt-3 h-5 w-5 shrink-0 accent-accent"
          aria-label="Include this row"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <TextInput
            value={row.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="Task name"
          />
          <TextArea
            value={row.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="Description (optional)"
            className="min-h-[64px]"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput type="date" value={row.date} onChange={(event) => set("date", event.target.value)} />
            <TextInput type="time" value={row.startTime} onChange={(event) => set("startTime", event.target.value)} />
            <TextInput type="time" value={row.endTime} onChange={(event) => set("endTime", event.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompanyField label="Company (optional)" value={row.companyName} onChange={(value) => set("companyName", value)} companies={companies} />
            <TagsField label="Tags (optional)" value={row.tagNames} onChange={(value) => set("tagNames", value)} tags={tags} />
          </div>
          <DurationInput
            label="Estimated time (optional)"
            value={row.estimatedMinutes}
            onChange={(estimatedMinutes) => set("estimatedMinutes", estimatedMinutes)}
            showStored={false}
          />
        </div>
        <GhostButton type="button" onClick={onRemove} className="min-h-9 min-w-9 rounded-2xl bg-panel2/50 px-3 text-risk ring-1 ring-line">
          <Trash2 className="h-4 w-4" />
        </GhostButton>
      </div>
    </SoftPanel>
  );
}

function toCreateItemPayload(fields: TodoTaskFields) {
  return {
    title: fields.title.trim(),
    description: fields.description.trim() || undefined,
    date: fields.date || undefined,
    startTime: fields.startTime || undefined,
    endTime: fields.endTime || undefined,
    objectiveId: fields.objectiveId || undefined,
    companyName: fields.companyName.trim() || undefined,
    tagNames: fields.tagNames,
    importance: fields.importance,
    productive: fields.productive,
    estimatedMinutes: fields.estimatedMinutes,
    completionPercent: fields.completionPercent,
    status: fields.status
  };
}

function toUpdatePayload(id: string, fields: TodoTaskFields) {
  return {
    id,
    title: fields.title.trim(),
    description: fields.description.trim(),
    date: fields.date || null,
    startTime: fields.startTime || null,
    endTime: fields.endTime || null,
    objectiveId: fields.objectiveId || null,
    companyName: fields.companyName.trim(),
    tagNames: fields.tagNames,
    importance: fields.importance,
    productive: fields.productive,
    estimatedMinutes: fields.estimatedMinutes,
    completionPercent: fields.completionPercent,
    status: fields.status
  };
}

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
