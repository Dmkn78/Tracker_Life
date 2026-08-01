"use client";

import { ChevronLeft, ChevronRight, CirclePlus, GripVertical } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { GhostButton, Metric, PrimaryButton, SecondaryButton, SectionHeader } from "@/components/ui";
import {
  deleteObjective as deleteObjectiveRequest,
  installObjectivesDemo,
  loadObjectives,
  saveObjective as saveObjectiveRequest
} from "@/features/objectives/api/objectivesApi";
import {
  ObjectiveEditorDrawer,
  type ObjectiveEditorState
} from "@/features/objectives/components/ObjectiveEditorDrawer";
import { ObjectiveExecutionSidebar } from "@/features/objectives/components/ObjectiveExecutionSidebar";
import {
  ObjectiveHierarchyPanel,
  type ObjectiveStructureView
} from "@/features/objectives/components/ObjectiveHierarchyPanel";
import { ObjectiveWeeklyPlanner } from "@/features/objectives/components/ObjectiveWeeklyPlanner";
import type { ObjectivesData } from "@/features/objectives/domain/objective";
import {
  defaultObjectiveDraft,
  defaultWeeklyBlockDraft,
  type ObjectiveDraft,
  type WeeklyBlockDraft
} from "@/features/objectives/domain/objectiveUi";
import { getWeekDateKeys, parseDateKey, shiftWeekId } from "@/lib/dates";

type ObjectivesClientProps = {
  initialData: ObjectivesData;
};

export function ObjectivesClient({ initialData }: ObjectivesClientProps) {
  const [data, setData] = useState(initialData);
  const [weekId, setWeekId] = useState(initialData.weekId);
  const [structureView, setStructureView] = useState<ObjectiveStructureView>("map");
  const [drawer, setDrawer] = useState<ObjectiveEditorState>(null);
  const [saving, setSaving] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [error, setError] = useState("");
  const loadControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => loadControllerRef.current?.abort(), []);

  const weekRangeLabel = useMemo(() => {
    const days = getWeekDateKeys(weekId);
    const start = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parseDateKey(days[0]));
    const end = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parseDateKey(days[6]));
    return `${start} - ${end}`;
  }, [weekId]);

  async function load(nextWeekId = weekId) {
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    setLoadingWeek(true);
    setError("");
    try {
      const nextData = await loadObjectives(nextWeekId, controller.signal);
      setData(nextData);
      setWeekId(nextWeekId);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load objectives.");
    } finally {
      if (loadControllerRef.current === controller) {
        loadControllerRef.current = null;
        setLoadingWeek(false);
      }
    }
  }

  function openCreateObjective(parentId = "") {
    setDrawer({
      type: "objective",
      mode: "create",
      draft: {
        ...defaultObjectiveDraft(),
        parentId
      }
    });
  }

  function openEditObjective(objective: ObjectivesData["objectives"][number]) {
    setDrawer({
      type: "objective",
      mode: "edit",
      draft: {
        id: objective.id,
        title: objective.title,
        parentId: objective.parentId ?? "",
        summary: objective.summary ?? "",
        nextAction: objective.nextAction ?? "",
        kind: objective.kind,
        horizon: objective.horizon,
        status: objective.status,
        priority: objective.priority,
        targetDate: objective.targetDate ?? data.weekDays[6],
        weekId: objective.weekId ?? weekId,
        color: objective.color,
        linkedTaskIds: objective.linkedTaskIds
      }
    });
  }

  function openCreateBlock(date: string, objectiveId = "") {
    setDrawer({
      type: "weekly_block",
      mode: "create",
      draft: {
        ...defaultWeeklyBlockDraft(date),
        objectiveId
      }
    });
  }

  function openEditBlock(block: ObjectivesData["weeklyBlocks"][number]) {
    setDrawer({
      type: "weekly_block",
      mode: "edit",
      draft: {
        id: block.id,
        title: block.title,
        objectiveId: block.objectiveId ?? "",
        category: block.category,
        date: block.date,
        startTime: block.startTime ?? "",
        endTime: block.endTime ?? "",
        durationMinutes: block.durationMinutes,
        flexible: block.flexible,
        note: block.note ?? ""
      }
    });
  }

  function updateObjectiveDraft(patch: Partial<ObjectiveDraft>) {
    setDrawer((current) =>
      current?.type === "objective"
        ? { ...current, draft: { ...current.draft, ...patch } }
        : current
    );
  }

  function updateWeeklyBlockDraft(patch: Partial<WeeklyBlockDraft>) {
    setDrawer((current) =>
      current?.type === "weekly_block"
        ? { ...current, draft: { ...current.draft, ...patch } }
        : current
    );
  }

  async function saveObjective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!drawer || drawer.type !== "objective") return;
    setSaving(true);
    setError("");
    try {
      const nextData = await saveObjectiveRequest(
        drawer.mode === "edit" ? "PATCH" : "POST",
        { ...drawer.draft }
      );
      setData(nextData);
      setDrawer(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Objective save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWeeklyBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!drawer || drawer.type !== "weekly_block") return;
    setSaving(true);
    setError("");
    try {
      const payload = { ...drawer.draft, kind: "weekly_block" as const, weekId };
      const nextData = await saveObjectiveRequest(
        drawer.mode === "edit" ? "PATCH" : "POST",
        payload
      );
      setData(nextData);
      setDrawer(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Weekly block save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function installDemo() {
    setSaving(true);
    setError("");
    try {
      setData(await installObjectivesDemo(weekId));
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : "Demo install failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrent() {
    if (!drawer) return;
    setSaving(true);
    setError("");
    try {
      if (!drawer.draft.id) throw new Error("Cannot delete an unsaved item.");
      setData(await deleteObjectiveRequest(drawer.draft.id, weekId, drawer.type));
      setDrawer(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  const stats = data.stats;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Objectives / Projects"
        title="Objectives"
        detail="Pilot the year, quarter, month, and week from one place. The tree stays strategic; the weekly board turns it into an executable plan."
        action={
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => openCreateObjective()}>
              <CirclePlus className="h-4 w-4" />
              Add objective
            </PrimaryButton>
            <SecondaryButton onClick={() => openCreateBlock(data.weekDays[0])}>
              <GripVertical className="h-4 w-4" />
              Plan block
            </SecondaryButton>
          </div>
        }
      />

      {error ? <div className="rounded-[20px] bg-risk/10 px-4 py-3 text-sm text-risk ring-1 ring-risk/15">{error}</div> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex items-center gap-2 rounded-[22px] bg-white/[0.045] p-1 ring-1 ring-white/8">
          <GhostButton onClick={() => void load(shiftWeekId(weekId, -1))} className="min-h-10 rounded-2xl px-3 text-slate-200">
            <ChevronLeft className="h-4 w-4" />
          </GhostButton>
          <div className="px-2 py-1 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{weekId}</p>
            <p className="text-sm font-medium text-slate-100">{loadingWeek ? "Loading..." : weekRangeLabel}</p>
          </div>
          <GhostButton onClick={() => void load(shiftWeekId(weekId, 1))} className="min-h-10 rounded-2xl px-3 text-slate-200">
            <ChevronRight className="h-4 w-4" />
          </GhostButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => void load(weekId)}>Refresh</SecondaryButton>
          <SecondaryButton onClick={() => void load(initialData.weekId)}>Current week</SecondaryButton>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active objectives" value={String(stats.activeObjectives)} />
        <Metric label="Projects" value={String(stats.projectCount)} detail={`${stats.horizonCoverage} horizons covered`} />
        <Metric label="Planned this week" value={stats.totalWeeklyMinutesLabel} />
        <Metric
          label="Busiest day"
          value={stats.busiestDay ? `${stats.busiestDay.label} ${stats.busiestDay.loadLabel}` : "none"}
          detail={`Imbalance ${stats.imbalanceLabel}`}
          tone={stats.imbalanceMinutes >= 300 ? "warn" : "neutral"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ObjectiveHierarchyPanel
          data={data}
          structureView={structureView}
          isSaving={saving}
          onChangeStructureView={setStructureView}
          onCreateObjective={openCreateObjective}
          onEditObjective={openEditObjective}
          onInstallDemo={() => void installDemo()}
        />
        <ObjectiveExecutionSidebar
          nextActions={data.nextActions}
          allocation={data.allocation}
          totalWeeklyMinutes={data.weekSummary.totalMinutes}
        />
      </div>

      <ObjectiveWeeklyPlanner
        weeklyDays={data.weeklyDays}
        totalMinutesLabel={data.weekSummary.totalMinutesLabel}
        highLoadDayCount={stats.highLoadDays}
        onCreateBlock={openCreateBlock}
        onEditBlock={openEditBlock}
      />

      <ObjectiveEditorDrawer
        editor={drawer}
        isSaving={saving}
        objectives={data.objectives}
        taskOptions={data.taskOptions}
        onClose={() => setDrawer(null)}
        onDelete={() => void deleteCurrent()}
        onObjectiveDraftChange={updateObjectiveDraft}
        onWeeklyBlockDraftChange={updateWeeklyBlockDraft}
        onSaveObjective={saveObjective}
        onSaveWeeklyBlock={saveWeeklyBlock}
      />
    </div>
  );
}
