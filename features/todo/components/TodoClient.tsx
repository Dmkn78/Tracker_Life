"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DurationInput } from "@/components/DurationInput";
import { CompanyField, TagsField } from "@/components/TagCompanyFields";
import { TodoList } from "@/features/todo/components/TodoList";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { TranslationKey } from "@/features/interface/localization/messages";
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
  listTodoTasksInRange,
  reorderTodoTasks,
  updateTodoTask,
  type TaskWritePayload
} from "@/features/todo/api/todoApi";
import { listCompanies } from "@/features/shared/api/companiesApi";
import { listTags } from "@/features/shared/api/tagsApi";
import type { Company, Tag } from "@/features/shared/domain/tagCompany";
import {
  emptyTodoTaskFields,
  isTodoImportance,
  isTodoStatus,
  setTodoTaskImportance,
  setTodoTaskProgress,
  setTodoTaskStatus,
  TODO_IMPORTANCE_LEVELS,
  TODO_STATUSES,
  todoTaskFieldsFromTask,
  toTodoTaskWriteValues,
  type ObjectiveOption,
  type TodoDescriptionChoice,
  type TodoImportance,
  type TodoScope,
  type TodoStatus,
  type TodoTask,
  type TodoTaskFields,
  type TodoTaskRow
} from "@/features/todo/domain/todoTask";
import {
  createSerializedWriteCoordinator,
  type SerializedWriteCoordinator,
  restoreTaskOrder
} from "@/features/todo/application/todoWriteCoordinator";
import {
  addDays,
  formatDisplayDate,
  getIsoWeekId,
  getWeekDateKeys,
  shiftWeekId
} from "@/lib/dates";
import { ApiError } from "@/lib/http/apiClient";

type DrawerState =
  | { kind: "edit"; id: string; draft: TodoTaskFields }
  | { kind: "create"; createMode: "single" | "multi"; single: TodoTaskFields; rows: TodoTaskRow[] };

type TaskWriteCoordinator = SerializedWriteCoordinator<string, TodoTask, TaskWritePayload>;
type ReorderWriteCoordinator = SerializedWriteCoordinator<string, string[], string[]>;

const REORDER_CHANNEL = "todo-order";

const SCOPE_LABEL_KEYS: Record<TodoScope, TranslationKey> = {
  today: "todo.scope.today",
  tomorrow: "todo.scope.tomorrow",
  week: "todo.scope.week",
  all: "todo.scope.all"
};
const IMPORTANCE_LABEL_KEYS: Record<TodoImportance, TranslationKey> = {
  low: "todo.importance.low",
  medium: "todo.importance.medium",
  high: "todo.importance.high"
};
const STATUS_LABEL_KEYS: Record<TodoStatus, TranslationKey> = {
  planned: "todo.status.planned",
  in_progress: "todo.status.inProgress",
  done: "todo.status.done",
  not_done: "todo.status.notDone",
  postponed: "todo.status.postponed",
  cancelled: "todo.status.cancelled"
};

let rowKeySeed = 0;
function newRow(date: string): TodoTaskRow {
  rowKeySeed += 1;
  return { ...emptyTodoTaskFields(date), key: `row-${rowKeySeed}`, enabled: true };
}

export function TodoClient({ today }: { today: string }) {
  const { locale, translate } = useLocale();
  const [date, setDate] = useState(today);
  const [scope, setScope] = useState<TodoScope>("today");
  const [weekId, setWeekId] = useState(() => getIsoWeekId(today));
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [objectiveOptions, setObjectiveOptions] = useState<ObjectiveOption[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [objectiveOptionsError, setObjectiveOptionsError] = useState<string | null>(null);
  const taskWriteCoordinatorRef = useRef<TaskWriteCoordinator | null>(null);
  const reorderWriteCoordinatorRef = useRef<ReorderWriteCoordinator | null>(null);

  if (!taskWriteCoordinatorRef.current) {
    taskWriteCoordinatorRef.current = createSerializedWriteCoordinator({
      applyWrite: (task, patch) => ({ ...task, ...patch }),
      executeWrite: (taskId, patch) => updateTodoTask({ id: taskId, ...patch }),
      publishState: (taskId, projectedTask) => {
        setTasks((currentTasks) =>
          currentTasks.map((task) => (task.id === taskId ? projectedTask : task))
        );
      }
    });
  }

  if (!reorderWriteCoordinatorRef.current) {
    reorderWriteCoordinatorRef.current = createSerializedWriteCoordinator({
      applyWrite: (_taskIds, orderedTaskIds) => orderedTaskIds,
      executeWrite: async (_channel, orderedTaskIds) => {
        await reorderTodoTasks(orderedTaskIds);
        return orderedTaskIds;
      },
      publishState: (_channel, projectedTaskIds) => {
        setTasks((currentTasks) => restoreTaskOrder(currentTasks, projectedTaskIds));
      }
    });
  }

  useEffect(() => {
    const requestController = new AbortController();
    const weekDays = getWeekDateKeys(weekId);
    const tasksRequest = scope === "week"
      ? listTodoTasksInRange({
          from: weekDays[0],
          to: weekDays[weekDays.length - 1],
          signal: requestController.signal
        })
      : listTodoTasks({ date, scope, signal: requestController.signal });
    setPageError(null);
    void tasksRequest
      .then((loadedTasks) => {
        const synchronizedTasks = loadedTasks.map((task) =>
          taskWriteCoordinatorRef.current!.synchronizeConfirmedState(task.id, task)
        );
        const projectedTaskIds = reorderWriteCoordinatorRef.current!.synchronizeConfirmedState(
          REORDER_CHANNEL,
          synchronizedTasks.map((task) => task.id)
        );
        setTasks(restoreTaskOrder(synchronizedTasks, projectedTaskIds));
      })
      .catch((error: unknown) => {
        if (!requestController.signal.aborted) {
          setPageError(readApiErrorMessage(error, translate("todo.loadError")));
        }
      });
    return () => requestController.abort();
  }, [date, scope, translate, weekId]);

  useEffect(() => {
    const requestController = new AbortController();
    setObjectiveOptionsError(null);
    void listObjectiveOptions(requestController.signal)
      .then(setObjectiveOptions)
      .catch((error: unknown) => {
        if (!requestController.signal.aborted) {
          setObjectiveOptionsError(readApiErrorMessage(error, translate("todo.objectivesError")));
        }
      });
    void listCompanies(requestController.signal)
      .then(setCompanies)
      .catch(() => undefined);
    void listTags(requestController.signal)
      .then(setTags)
      .catch(() => undefined);
    return () => requestController.abort();
  }, [translate]);

  function changeScope(nextScope: TodoScope) {
    setScope(nextScope);
    if (nextScope === "today") setDate(today);
    if (nextScope === "tomorrow") setDate(addDays(today, 1));
    if (nextScope === "week") setWeekId(getIsoWeekId(date));
  }

  function openCreate() {
    setDrawerError(null);
    setDrawer({
      kind: "create",
      createMode: "single",
      single: emptyTodoTaskFields(getCreationDate(scope, date, weekId)),
      rows: [
        newRow(getCreationDate(scope, date, weekId)),
        newRow(getCreationDate(scope, date, weekId))
      ]
    });
  }

  function openEdit(task: TodoTask) {
    setDrawerError(null);
    setDrawer({
      kind: "edit",
      id: task.id,
      draft: todoTaskFieldsFromTask(task)
    });
  }

  async function saveTask(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer) return;
    setDrawerError(null);

    if (drawer.kind === "edit") {
      const task = tasks.find((candidate) => candidate.id === drawer.id);
      if (!task) return;
      taskWriteCoordinatorRef.current!.synchronizeConfirmedState(task.id, task);
      setSaving(true);
      try {
        await taskWriteCoordinatorRef.current!.enqueueWrite(
          drawer.id,
          toTodoTaskWriteValues(drawer.draft)
        );
        setDrawer(null);
      } catch (error: unknown) {
        setDrawerError(readApiErrorMessage(error, translate("todo.saveError")));
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
        translate(drawer.createMode === "single" ? "todo.singleNameRequired" : "todo.multiNameRequired")
      );
      return;
    }

    setSaving(true);
    try {
      const createdTasks = await createTodoTasks({ items });
      setTasks((current) => [...createdTasks, ...current]);
      setDrawer(null);
    } catch (error: unknown) {
      setDrawerError(readApiErrorMessage(error, translate("todo.saveManyError")));
    } finally {
      setSaving(false);
    }
  }

  function patchTask(id: string, patch: TaskWritePayload): void {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task) return;
    taskWriteCoordinatorRef.current!.synchronizeConfirmedState(id, task);
    setPageError(null);
    void taskWriteCoordinatorRef.current!.enqueueWrite(id, patch).catch((error: unknown) => {
      setPageError(readApiErrorMessage(error, translate("todo.updateError")));
    });
  }

  function reorderTasks(orderedIds: string[]): void {
    reorderWriteCoordinatorRef.current!.synchronizeConfirmedState(
      REORDER_CHANNEL,
      tasks.map((task) => task.id)
    );
    setPageError(null);
    void reorderWriteCoordinatorRef.current!.enqueueWrite(REORDER_CHANNEL, orderedIds).catch(
      (error: unknown) => {
        setPageError(readApiErrorMessage(error, translate("todo.reorderError")));
      }
    );
  }

  async function deleteTask(task: TodoTask) {
    if (!window.confirm(translate("todo.deleteConfirm", { title: task.title }))) return;
    const previousTasks = tasks;
    setPageError(null);
    setTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await deleteTodoTask(task.id);
    } catch (error: unknown) {
      setTasks(previousTasks);
      setPageError(readApiErrorMessage(error, translate("todo.deleteError")));
    }
  }

  const completed = tasks.filter((task) => task.status === "done" || task.completionPercent >= 100).length;
  const averageDone = tasks.length === 0 ? 0 : Math.round(tasks.reduce((sum, task) => sum + task.completionPercent, 0) / tasks.length);
  const totalEstimatedMinutes = tasks.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={scope === "all"
          ? translate("todo.allTasks")
          : scope === "week"
            ? formatWeekRange(weekId, locale)
            : formatDisplayDate(date, locale)}
        title={translate("todo.title")}
        detail={translate("todo.detail")}
        action={
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {translate("todo.add")}
            </PrimaryButton>
          </div>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented aria-label={translate("todo.scopeOptions")} className="w-full lg:w-auto">
          {(["today", "tomorrow", "week", "all"] as const).map((item) => (
            <SegmentedButton key={item} active={scope === item} onClick={() => changeScope(item)}>
              {translate(SCOPE_LABEL_KEYS[item])}
            </SegmentedButton>
          ))}
        </Segmented>
        {scope === "week" ? (
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            <SecondaryButton
              aria-label={translate("todo.previousWeek")}
              onClick={() => setWeekId((currentWeekId) => shiftWeekId(currentWeekId, -1))}
              className="min-w-11 px-3"
            >
              <ChevronLeft className="h-4 w-4" />
            </SecondaryButton>
            <SecondaryButton onClick={() => setWeekId(getIsoWeekId(today))} className="flex-1 sm:flex-none">
              {translate("todo.currentWeek")}
            </SecondaryButton>
            <SecondaryButton
              aria-label={translate("todo.nextWeek")}
              onClick={() => setWeekId((currentWeekId) => shiftWeekId(currentWeekId, 1))}
              className="min-w-11 px-3"
            >
              <ChevronRight className="h-4 w-4" />
            </SecondaryButton>
          </div>
        ) : scope !== "all" ? (
          <TextInput
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full sm:w-auto sm:min-w-[170px]"
          />
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label={translate("todo.tasks")} value={String(tasks.length)} />
        <Metric label={translate("todo.done")} value={`${completed}/${tasks.length || 0}`} tone={completed > 0 ? "good" : "neutral"} />
        <Metric
          label={translate("todo.plannedTime")}
          value={formatMinutes(totalEstimatedMinutes)}
          detail={translate("todo.averageDone", { percent: averageDone })}
        />
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
        title={translate(drawer?.kind === "edit" ? "todo.editTask" : "todo.addTask")}
        description={
          drawer?.kind === "edit"
            ? translate("todo.editDescription")
            : translate("todo.addDescription")
        }
        onClose={() => setDrawer(null)}
        width="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <SecondaryButton onClick={() => setDrawer(null)}>{translate("todo.cancel")}</SecondaryButton>
            <PrimaryButton form="task-editor-form" type="submit" disabled={saving}>
              {translate(saving
                ? "todo.saving"
                : drawer?.kind === "edit"
                  ? "todo.saveTask"
                  : "todo.createTasks")}
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
              <Segmented aria-label={translate("todo.creationMode")} className="w-full">
                <SegmentedButton
                  type="button"
                  className="flex-1"
                  active={drawer.createMode === "single"}
                  onClick={() => setDrawer((current) => (current?.kind === "create" ? { ...current, createMode: "single" } : current))}
                >
                  {translate("todo.singleTask")}
                </SegmentedButton>
                <SegmentedButton
                  type="button"
                  className="flex-1"
                  active={drawer.createMode === "multi"}
                  onClick={() => setDrawer((current) => (current?.kind === "create" ? { ...current, createMode: "multi" } : current))}
                >
                  {translate("todo.createMultiple")}
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
                      current?.kind === "create"
                        ? { ...current, rows: [...current.rows, newRow(getCreationDate(scope, date, weekId))] }
                        : current
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                  {translate("todo.addRow")}
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
  const { translate } = useLocale();

  function set<K extends keyof TodoTaskFields>(key: K, value: TodoTaskFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  function setDescriptionChoice(descriptionChoice: TodoDescriptionChoice): void {
    onChange({
      ...fields,
      descriptionChoice,
      description: descriptionChoice === "yes" ? fields.description : ""
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>{translate("todo.name")}</FieldLabel>
        <TextInput
          value={fields.title}
          onChange={(event) => set("title", event.target.value)}
          className="mt-2"
          placeholder={translate("todo.namePlaceholder")}
          required
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-muted">{translate("todo.descriptionChoice")}</legend>
        <Segmented aria-label={translate("todo.descriptionChoice")} className="mt-2 w-full">
          {(["yes", "no"] as const).map((choice) => (
            <SegmentedButton
              key={choice}
              type="button"
              active={fields.descriptionChoice === choice}
              onClick={() => setDescriptionChoice(choice)}
              className="flex-1"
            >
              {translate(choice === "yes" ? "todo.yes" : "todo.no")}
            </SegmentedButton>
          ))}
        </Segmented>
      </fieldset>
      {fields.descriptionChoice === "yes" ? (
        <div>
          <FieldLabel>{translate("todo.descriptionOptional")}</FieldLabel>
          <TextArea
            value={fields.description}
            onChange={(event) => set("description", event.target.value)}
            className="mt-2 min-h-[96px]"
            placeholder={translate("todo.descriptionPlaceholder")}
          />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <FieldLabel>{translate("todo.dateOptional")}</FieldLabel>
          <TextInput type="date" value={fields.date} onChange={(event) => set("date", event.target.value)} className="mt-2" />
        </div>
        <div>
          <FieldLabel>{translate("todo.startTimeOptional")}</FieldLabel>
          <TextInput type="time" value={fields.startTime} onChange={(event) => set("startTime", event.target.value)} className="mt-2" />
        </div>
        <div>
          <FieldLabel>{translate("todo.endTimeOptional")}</FieldLabel>
          <TextInput type="time" value={fields.endTime} onChange={(event) => set("endTime", event.target.value)} className="mt-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>{translate("todo.objective")}</FieldLabel>
          <SelectInput value={fields.objectiveId} onChange={(event) => set("objectiveId", event.target.value)} className="mt-2 w-full">
            <option value="">{translate("todo.noObjective")}</option>
            {objectiveOptions.map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.title} · {objective.horizon}
              </option>
            ))}
          </SelectInput>
        </div>
        <DurationInput
          label={translate("todo.estimatedTimeOptional")}
          value={fields.estimatedMinutes}
          onChange={(estimatedMinutes) => set("estimatedMinutes", estimatedMinutes)}
          showStored={false}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CompanyField
          label={translate("todo.company")}
          placeholder={translate("todo.noCompany")}
          value={fields.companyName}
          onChange={(value) => set("companyName", value)}
          companies={companies}
        />
        <TagsField
          label={translate("todo.tags")}
          placeholder={translate("todo.addTag")}
          removeTagLabel={(name) => translate("todo.removeTag", { name })}
          value={fields.tagNames}
          onChange={(value) => set("tagNames", value)}
          tags={tags}
        />
      </div>
      <div>
        <FieldLabel>{translate("todo.importance")}</FieldLabel>
        <SelectInput
          aria-label={translate("todo.importance")}
          value={fields.importance}
          onChange={(event) => {
            if (isTodoImportance(event.target.value)) {
              onChange(setTodoTaskImportance(fields, event.target.value));
            }
          }}
          className="mt-2"
        >
          {TODO_IMPORTANCE_LEVELS.map((importance) => (
            <option key={importance} value={importance}>
              {translate(IMPORTANCE_LABEL_KEYS[importance])}
            </option>
          ))}
        </SelectInput>
      </div>
      {showStatus ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>{translate("todo.status")}</FieldLabel>
            <SelectInput
              aria-label={translate("todo.status")}
              value={fields.status}
              onChange={(event) => {
                if (isTodoStatus(event.target.value)) {
                  onChange(setTodoTaskStatus(fields, event.target.value));
                }
              }}
              className="mt-2"
            >
              {TODO_STATUSES.map((status) => (
                <option key={status} value={status}>{translate(STATUS_LABEL_KEYS[status])}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>{translate("todo.progress")}</FieldLabel>
            <div className="mt-2">
              <Segmented aria-label={translate("todo.progressOptions")} className="w-full">
                {[0, 25, 50, 75, 100].map((value) => (
                  <SegmentedButton
                    key={value}
                    active={fields.completionPercent === value}
                    onClick={() => onChange(setTodoTaskProgress(fields, value))}
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
      {fields.status === "not_done" ? (
        <div>
          <FieldLabel>{translate("todo.notDoneReason")}</FieldLabel>
          <TextArea
            value={fields.notDoneReason}
            onChange={(event) => set("notDoneReason", event.target.value)}
            className="mt-2 min-h-[80px]"
            placeholder={translate("todo.notDoneReasonPlaceholder")}
          />
        </div>
      ) : null}
      <label className="flex items-center gap-3 rounded-[20px] bg-panel2/60 px-4 py-3 ring-1 ring-line text-sm text-ink">
        <input
          type="checkbox"
          checked={fields.productive}
          onChange={(event) => set("productive", event.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        {translate("todo.productive")}
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
  const { translate } = useLocale();

  function set<K extends keyof TodoTaskRow>(key: K, value: TodoTaskRow[K]) {
    onChange({ ...row, [key]: value });
  }

  function setDescriptionChoice(descriptionChoice: TodoDescriptionChoice): void {
    onChange({
      ...row,
      descriptionChoice,
      description: descriptionChoice === "yes" ? row.description : ""
    });
  }

  return (
    <SoftPanel className={`space-y-3 p-4 transition ${row.enabled ? "" : "opacity-50"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={row.enabled}
          onChange={(event) => set("enabled", event.target.checked)}
          className="mt-3 h-5 w-5 shrink-0 accent-accent"
          aria-label={translate("todo.includeRow")}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <TextInput
            value={row.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder={translate("todo.taskName")}
          />
          <fieldset>
            <legend className="text-sm font-medium text-muted">{translate("todo.descriptionChoice")}</legend>
            <Segmented aria-label={translate("todo.descriptionChoice")} className="mt-2 w-full">
              {(["yes", "no"] as const).map((choice) => (
                <SegmentedButton
                  key={choice}
                  type="button"
                  active={row.descriptionChoice === choice}
                  onClick={() => setDescriptionChoice(choice)}
                  className="flex-1"
                >
                  {translate(choice === "yes" ? "todo.yes" : "todo.no")}
                </SegmentedButton>
              ))}
            </Segmented>
          </fieldset>
          {row.descriptionChoice === "yes" ? (
            <TextArea
              value={row.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder={translate("todo.descriptionPlaceholder")}
              className="min-h-[64px]"
            />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput type="date" value={row.date} onChange={(event) => set("date", event.target.value)} />
            <TextInput type="time" value={row.startTime} onChange={(event) => set("startTime", event.target.value)} />
            <TextInput type="time" value={row.endTime} onChange={(event) => set("endTime", event.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompanyField
              label={translate("todo.companyOptional")}
              placeholder={translate("todo.noCompany")}
              value={row.companyName}
              onChange={(value) => set("companyName", value)}
              companies={companies}
            />
            <TagsField
              label={translate("todo.tagsOptional")}
              placeholder={translate("todo.addTag")}
              removeTagLabel={(name) => translate("todo.removeTag", { name })}
              value={row.tagNames}
              onChange={(value) => set("tagNames", value)}
              tags={tags}
            />
          </div>
          <DurationInput
            label={translate("todo.estimatedTimeOptional")}
            value={row.estimatedMinutes}
            onChange={(estimatedMinutes) => set("estimatedMinutes", estimatedMinutes)}
            showStored={false}
          />
        </div>
        <GhostButton aria-label={translate("todo.removeRow")} type="button" onClick={onRemove} className="min-h-9 min-w-9 rounded-2xl bg-panel2/50 px-3 text-risk ring-1 ring-line">
          <Trash2 className="h-4 w-4" />
        </GhostButton>
      </div>
    </SoftPanel>
  );
}

function toCreateItemPayload(fields: TodoTaskFields): ReturnType<typeof toTodoTaskWriteValues> {
  return toTodoTaskWriteValues(fields);
}

function getCreationDate(scope: TodoScope, date: string, weekId: string): string {
  return scope === "week" ? getWeekDateKeys(weekId)[0] : date;
}

function formatWeekRange(weekId: string, locale: string): string {
  const weekDays = getWeekDateKeys(weekId);
  const rangeFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const startLabel = rangeFormatter.format(new Date(`${weekDays[0]}T12:00:00`));
  const endLabel = rangeFormatter.format(new Date(`${weekDays[weekDays.length - 1]}T12:00:00`));
  return `${weekId} · ${startLabel} – ${endLabel}`;
}

function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
