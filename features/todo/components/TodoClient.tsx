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
  createWeeklyTodoObjective,
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
  hasTodoTaskContent,
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
import { PerformanceStrip } from "@/features/performance/components/PerformanceStrip";
import { TodoWeeklyCalendar, TodoMonthlyRoadmap, TodoExecutionInsights } from "./TodoPlanningViews";
import { TaskFunnel } from "./TaskFunnel";
import { TodoExecutionDrawer } from "./TodoExecutionDrawer";
import { TodoObjectiveTrajectory } from "./TodoObjectiveTrajectory";
import { monthRange, summarizeTasks, taskSlot } from "../domain/todoPlanning";
import { logTodoExecution } from "../api/todoApi";
import { AssistantPanel } from "@/features/assistant/components/AssistantPanel";
import { TaskContentEditor } from "./TaskContentEditor";
import { TodoTemplatePanel } from "./TodoTemplatePanel";

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
  month: "todo.scope.month",
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

export function TodoClient({ today, initialView = "funnel", createDate, onCreateOpened, refreshKey = 0 }: {
  today: string;
  initialView?: "list" | "funnel";
  createDate?: string | null;
  onCreateOpened?: () => void;
  refreshKey?: number;
}) {
  const { locale, translate } = useLocale();
  const [date, setDate] = useState(today);
  const [scope, setScope] = useState<TodoScope>(initialView === "funnel" ? "all" : "today");
  const [weekId, setWeekId] = useState(() => getIsoWeekId(today));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [view, setView] = useState<"list" | "weekly" | "monthly" | "insights" | "funnel">(initialView);
  const [search, setSearch] = useState("");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [executionTask, setExecutionTask] = useState<TodoTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [assistantRefreshKey, setAssistantRefreshKey] = useState(0);
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
  const objectiveMutationRevisionRef = useRef(0);

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
    if (!createDate) return;
    setDate(createDate); setScope("today"); setView("list");
    setSearch(""); setObjectiveFilter("all"); setStatusFilter("all");
    setDrawerError(null);
    setDrawer({ kind: "create", createMode: "single", single: emptyTodoTaskFields(createDate), rows: [newRow(createDate), newRow(createDate)] });
    onCreateOpened?.();
  }, [createDate, onCreateOpened]);

  useEffect(() => {
    const requestController = new AbortController();
    const weekDays = getWeekDateKeys(weekId);
    const tasksRequest = scope === "month"
      ? listTodoTasksInRange({ from: monthRange(month).start, to: monthRange(month).end, signal: requestController.signal })
      : scope === "week"
      ? listTodoTasksInRange({
          from: weekDays[0],
          to: weekDays[weekDays.length - 1],
          signal: requestController.signal
        })
      : listTodoTasks({ date, scope, signal: requestController.signal });
    setPageError(null);
    setLoading(true);
    void tasksRequest
      .then((loadedTasks) => {
        if (requestController.signal.aborted) return;
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
      }).finally(() => { if (!requestController.signal.aborted) setLoading(false); });
    return () => requestController.abort();
  }, [date, month, scope, translate, weekId, refreshKey, assistantRefreshKey]);

  useEffect(() => {
    const requestController = new AbortController();
    const mutationRevision = objectiveMutationRevisionRef.current;
    setObjectiveOptionsError(null);
    void listObjectiveOptions(requestController.signal)
      .then((loadedObjectives) => {
        if (requestController.signal.aborted) return;
        setObjectiveOptions((current) => {
          if (mutationRevision === objectiveMutationRevisionRef.current) return loadedObjectives;
          const optionsById = new Map(loadedObjectives.map((objective) => [objective.id, objective]));
          current.forEach((objective) => optionsById.set(objective.id, objective));
          return [...optionsById.values()];
        });
      })
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
    if (nextScope === "month") setMonth(date.slice(0, 7));
    if (view === "funnel" && nextScope !== "all") setView("list");
    if (view === "weekly" && nextScope !== "week") setView("list");
    if (view === "monthly" && nextScope !== "month") setView("list");
  }

  function openCreate(slotDate?: string, startTime?: string, objectiveId?: string) {
    const creationDate = slotDate ?? (scope === "month" ? `${month}-01` : getCreationDate(scope, date, weekId));
    const linkedObjectiveId = objectiveId ?? (objectiveFilter === "all" || objectiveFilter === "unassigned" ? "" : objectiveFilter);
    setDrawerError(null);
    setDrawer({
      kind: "create",
      createMode: "single",
      single: { ...emptyTodoTaskFields(creationDate), ...(startTime ? taskSlot(creationDate, startTime) : {}), objectiveId: linkedObjectiveId },
      rows: [
        { ...newRow(creationDate), objectiveId: linkedObjectiveId },
        { ...newRow(creationDate), objectiveId: linkedObjectiveId }
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
      if (!hasTodoTaskContent(drawer.draft)) {
        setDrawerError(translate("todo.singleNameRequired"));
        return;
      }
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
        ? hasTodoTaskContent(drawer.single)
          ? [toCreateItemPayload(drawer.single)]
          : []
        : drawer.rows
            .filter((row) => row.enabled && hasTodoTaskContent(row))
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

  async function patchTask(id: string, patch: TaskWritePayload): Promise<boolean> {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task) return false;
    taskWriteCoordinatorRef.current!.synchronizeConfirmedState(id, task);
    setPageError(null);
    try {
      await taskWriteCoordinatorRef.current!.enqueueWrite(id, patch);
      window.dispatchEvent(new Event("performance-updated"));
      return true;
    } catch (error: unknown) {
      setPageError(readApiErrorMessage(error, translate("todo.updateError")));
      return false;
    }
  }

  async function createFunnelObjective(input: { title: string; weekId: string }): Promise<ObjectiveOption> {
    const objective = await createWeeklyTodoObjective(input);
    objectiveMutationRevisionRef.current += 1;
    setObjectiveOptions((current) => [...current.filter((option) => option.id !== objective.id), objective]);
    setObjectiveOptionsError(null);
    return objective;
  }

  async function captureFunnelTask(input: { title: string; objectiveId: string | null; estimatedMinutes: number }): Promise<void> {
    const created = await createTodoTasks({ items: [{ ...input, date: null }] });
    setTasks((current) => [...created, ...current]);
  }

  async function saveExecution(payload: Parameters<typeof logTodoExecution>[0]): Promise<void> {
    await taskWriteCoordinatorRef.current!.whenIdle(payload.taskId);
    const savedTask = await logTodoExecution(payload);
    const projected = taskWriteCoordinatorRef.current!.synchronizeConfirmedState(savedTask.id, savedTask);
    setTasks((current) => current.map((task) => task.id === savedTask.id ? projected : task));
    window.dispatchEvent(new Event("performance-updated"));
  }

  function reorderTasks(orderedIds: string[]): void {
    const reorderedSet = new Set(orderedIds);
    let nextIndex = 0;
    const mergedOrder = tasks.map((task) => reorderedSet.has(task.id) ? orderedIds[nextIndex++] : task.id);
    reorderWriteCoordinatorRef.current!.synchronizeConfirmedState(
      REORDER_CHANNEL,
      tasks.map((task) => task.id)
    );
    setPageError(null);
    void reorderWriteCoordinatorRef.current!.enqueueWrite(REORDER_CHANNEL, mergedOrder).catch(
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

  const filteredTasks = tasks.filter((task) => (!search || `${task.title} ${task.description ?? ""} ${task.objectiveTitle ?? ""}`.toLowerCase().includes(search.toLowerCase())) && (objectiveFilter === "all" || (objectiveFilter === "unassigned" ? !task.objectiveId : task.objectiveId === objectiveFilter)) && (statusFilter === "all" || task.status === statusFilter));
  const summary = summarizeTasks(filteredTasks, today);
  const fr = locale === "fr";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={scope === "all"
          ? translate("todo.allTasks")
          : scope === "month" ? month : scope === "week"
            ? formatWeekRange(weekId, locale)
            : formatDisplayDate(date, locale)}
        title={translate("todo.title")}
        detail={translate("todo.detail")}
        action={
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => openCreate()}>
              <Plus className="h-4 w-4" />
              {translate("todo.add")}
            </PrimaryButton>
          </div>
        }
      />

      <div className="space-y-3">
        <Segmented aria-label={translate("todo.workflowViews")} className="w-full sm:w-auto">
          <SegmentedButton active={view === "funnel"} onClick={() => { setView("funnel"); setScope("all"); setSearch(""); setObjectiveFilter("all"); setStatusFilter("all"); }}>{translate("todo.prepareWeek")}</SegmentedButton>
          <SegmentedButton active={view === "list"} onClick={() => { setView("list"); changeScope("today"); }}>{translate("todo.taskList")}</SegmentedButton>
        </Segmented>
        <details className="rounded-2xl border border-line px-4 py-3" open={view === "weekly" || view === "monthly" || view === "insights" ? true : undefined}>
          <summary className="focus-ring cursor-pointer text-sm text-muted">{translate("todo.otherViews")}</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryButton onClick={() => { setView("weekly"); setScope("week"); }}>{translate("todo.weekCalendar")}</SecondaryButton>
            <SecondaryButton onClick={() => { setView("monthly"); setScope("month"); }}>{translate("todo.monthView")}</SecondaryButton>
            <SecondaryButton onClick={() => { setView("insights"); setScope("week"); }}>{translate("todo.weekReview")}</SecondaryButton>
          </div>
          <p className="mt-2 text-xs text-muted">{translate("todo.reviewHelp")}</p>
        </details>
      </div>

      {view !== "funnel" ? <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented aria-label={translate("todo.scopeOptions")} className="w-full lg:w-auto">
          {(["today", "tomorrow", "week", "month", "all"] as const).map((item) => (
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
        ) : scope === "month" ? <div className="flex w-full items-center gap-2 lg:w-auto">
          <SecondaryButton aria-label={fr ? "Mois précédent" : "Previous month"} className="px-3" onClick={() => setMonth((current) => addDays(`${current}-01`, -1).slice(0, 7))}><ChevronLeft className="h-4 w-4" /></SecondaryButton>
          <TextInput aria-label={fr ? "Mois affiché" : "Displayed month"} type="month" value={month} onChange={(event) => { if (event.target.value) setMonth(event.target.value); }} className="min-w-0 flex-1 lg:w-auto" />
          <SecondaryButton aria-label={fr ? "Mois suivant" : "Next month"} className="px-3" onClick={() => setMonth((current) => addDays(monthRange(current).end, 1).slice(0, 7))}><ChevronRight className="h-4 w-4" /></SecondaryButton>
        </div> : scope !== "all" ? (
          <TextInput
            type="date"
            value={date}
            onChange={(event) => { if (event.target.value) setDate(event.target.value); }}
            className="w-full sm:w-auto sm:min-w-[170px]"
          />
        ) : null}
      </div> : null}

      {view !== "funnel" ? <details className="rounded-2xl border border-line px-4 py-3"><summary className="focus-ring cursor-pointer text-sm text-muted">{translate("todo.taskSummary")}</summary><div className="mt-3 grid gap-3 md:grid-cols-3">
        <Metric label={translate("todo.tasks")} value={String(filteredTasks.length)} />
        <Metric label={translate("todo.done")} value={`${summary.completed}/${summary.total}`} tone={summary.completed > 0 ? "good" : "neutral"} />
        <Metric
          label={translate("todo.plannedTime")}
          value={formatMinutes(summary.plannedMinutes)}
          detail={translate("todo.averageDone", { percent: summary.progress })}
        />
      </div></details> : null}

      {pageError ? (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {pageError}
        </p>
      ) : null}

      {view !== "funnel" ? <details className="rounded-2xl border border-line px-4 py-3"><summary className="focus-ring cursor-pointer text-sm text-muted">{translate("todo.searchFilters")}</summary><div className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3"><TextInput aria-label={fr ? "Rechercher une tâche" : "Find a task"} placeholder={fr ? "Rechercher une tâche…" : "Find a task…"} value={search} onChange={(event) => setSearch(event.target.value)} /><SelectInput aria-label={fr ? "Filtrer par objectif" : "Filter by objective"} value={objectiveFilter} onChange={(event) => setObjectiveFilter(event.target.value)}><option value="all">{fr ? "Tous les objectifs" : "All objectives"}</option><option value="unassigned">{fr ? "Sans objectif" : "Unassigned"}</option>{objectiveOptions.map((objective) => <option key={objective.id} value={objective.id}>{objective.title} · {objective.horizon}</option>)}</SelectInput><SelectInput aria-label={fr ? "Filtrer par statut" : "Filter by status"} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{fr ? "Tous les statuts" : "All statuses"}</option>{TODO_STATUSES.map((status) => <option key={status} value={status}>{translate(STATUS_LABEL_KEYS[status])}</option>)}</SelectInput></div>
      </div></details> : null}
      {objectiveOptionsError && view === "funnel" ? <p role="alert" className="rounded-xl bg-risk/10 px-3 py-2 text-sm text-risk">{objectiveOptionsError}</p> : null}
      {loading ? <SoftPanel><p role="status" className="text-sm text-muted">{fr ? "Chargement des tâches…" : "Loading tasks…"}</p></SoftPanel> : <>
        {view === "list" ? <SoftPanel className="p-3"><TodoList tasks={filteredTasks} onPatch={patchTask} onEdit={openEdit} onAdd={() => openCreate()} onDelete={deleteTask} onReorder={reorderTasks} onLog={setExecutionTask} /></SoftPanel> : null}
        {view === "funnel" ? <TaskFunnel tasks={tasks} objectives={objectiveOptions} today={today} onEdit={openEdit} onMove={patchTask} onCapture={captureFunnelTask} onCreateObjective={createFunnelObjective} /> : null}
        {view === "weekly" ? <TodoWeeklyCalendar tasks={filteredTasks} objectives={objectiveOptions} today={today} startDate={getWeekDateKeys(weekId)[0]} objectiveId={objectiveFilter === "all" || objectiveFilter === "unassigned" ? "" : objectiveFilter} onEdit={openEdit} onCreate={openCreate} onMove={patchTask} /> : null}
        {view === "monthly" ? <TodoMonthlyRoadmap tasks={filteredTasks} objectives={objectiveOptions} month={month} today={today} onEdit={openEdit} onCreate={openCreate} /> : null}
        {view === "insights" ? <><TodoExecutionInsights tasks={filteredTasks} objectives={objectiveOptions} today={today} onEdit={openEdit} onCreate={openCreate} /><TodoObjectiveTrajectory tasks={filteredTasks} objectives={objectiveOptions} month={scope === "month" ? month : today.slice(0, 7)} /></> : null}
      </>}
      <details className="rounded-2xl border border-line px-4 py-3"><summary className="focus-ring cursor-pointer text-sm text-muted">{translate("todo.assistantHelp")}</summary><div className="mt-4"><AssistantPanel date={getCreationDate(scope, date, weekId)} onTasksCreated={() => setAssistantRefreshKey((current) => current + 1)} /></div></details>
      <details className="rounded-2xl border border-line px-4 py-3"><summary className="focus-ring cursor-pointer text-sm text-muted">{translate("todo.performanceReview")}</summary><div className="mt-4"><PerformanceStrip refreshKey={tasks} /></div></details>
      {executionTask ? <TodoExecutionDrawer key={executionTask.id} task={executionTask} today={today} onClose={() => setExecutionTask(null)} onSave={saveExecution} /> : null}

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
        {drawer?.kind === "edit" ? <div className="mb-4 flex flex-wrap gap-2"><SecondaryButton type="button" onClick={() => { const task = tasks.find((item) => item.id === drawer.id); if (task) { setDrawer(null); setExecutionTask(task); } }}>{translate("todo.logExecution")}</SecondaryButton><a className="focus-ring rounded-2xl px-3 py-2 text-sm text-accent" href="/objectives/forecasts">{fr ? "Ouvrir les objectifs et prévisions" : "Open objectives & forecasts"}</a></div> : null}
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
                        ? { ...current, rows: [...current.rows, { ...newRow(current.single.date), objectiveId: current.single.objectiveId }] }
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

  return (
    <div className="space-y-4">
      <TaskContentEditor fields={fields} onChange={onChange} autoFocus />
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
      <details className="rounded-2xl border border-line px-4 py-3">
        <summary className="focus-ring cursor-pointer text-sm text-muted">{translate("todo.taskDetails")}</summary>
        <div className="mt-4 space-y-4">
      <TodoTemplatePanel fields={fields} onChange={onChange} />
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
      </details>
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
          <TaskContentEditor fields={row} onChange={(fields) => onChange({ ...row, ...fields })} />
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
