"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  GripVertical,
  Link2,
  PencilLine,
  Sparkles,
  Trash2
} from "lucide-react";
import { useMemo, useState } from "react";
import { DurationInput, formatDuration } from "@/components/DurationInput";
import {
  Card,
  Drawer,
  FieldLabel,
  GhostButton,
  Metric,
  Pill,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  Segmented,
  SegmentedButton,
  SelectInput,
  SoftPanel,
  TextArea,
  TextInput
} from "@/components/ui";
import {
  defaultObjectiveDraft,
  defaultWeeklyBlockDraft,
  formatMinutes,
  objectiveHorizons,
  objectiveKinds,
  objectivePriorities,
  objectiveStatuses,
  type ObjectivesData,
  weeklyPlanCategories
} from "@/lib/objectives";
import { getWeekDateKeys, parseDateKey, shiftWeekId } from "@/lib/dates";

type ObjectiveDraft = ReturnType<typeof defaultObjectiveDraft> & { id?: string };
type WeeklyBlockDraft = ReturnType<typeof defaultWeeklyBlockDraft> & { id?: string };

type DrawerState =
  | { type: "objective"; mode: "create" | "edit"; draft: ObjectiveDraft }
  | { type: "weekly_block"; mode: "create" | "edit"; draft: WeeklyBlockDraft }
  | null;

export function ObjectivesClient({ initialData }: { initialData: ObjectivesData }) {
  const [data, setData] = useState(initialData);
  const [weekId, setWeekId] = useState(initialData.weekId);
  const [structureView, setStructureView] = useState<"map" | "tree">("map");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [saving, setSaving] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [error, setError] = useState("");

  const objectiveOptions = useMemo(
    () =>
      data.objectives.map((objective) => ({
        id: objective.id,
        title: objective.title,
        horizon: objective.horizon,
        color: objective.color
      })),
    [data.objectives]
  );

  const weekRangeLabel = useMemo(() => {
    const days = getWeekDateKeys(weekId);
    const start = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parseDateKey(days[0]));
    const end = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parseDateKey(days[6]));
    return `${start} - ${end}`;
  }, [weekId]);

  const objectivesByHorizon = useMemo(() => {
    const parentMap = new Map(data.objectives.map((objective) => [objective.id, objective]));
    const horizons = ["year", "quarter", "month", "week"] as const;
    return horizons.map((horizon) => ({
      horizon,
      items: data.objectives
        .filter((objective) => objective.horizon === horizon)
        .map((objective) => ({
          ...objective,
          parentTitle: objective.parentId ? parentMap.get(objective.parentId)?.title ?? null : null
        }))
    }));
  }, [data.objectives]);

  const objectivePaths = useMemo(() => buildObjectivePaths(data.tree), [data.tree]);

  async function load(nextWeekId = weekId) {
    setLoadingWeek(true);
    setError("");
    try {
      const response = await fetch(`/api/objectives?week_id=${nextWeekId}`);
      const nextData = await response.json();
      setData(nextData);
      setWeekId(nextWeekId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load objectives.");
    } finally {
      setLoadingWeek(false);
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

  async function saveObjective(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer || drawer.type !== "objective") return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/objectives", {
        method: drawer.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drawer.draft)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Objective save failed.");
      setData(json.data ?? json);
      setDrawer(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Objective save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWeeklyBlock(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer || drawer.type !== "weekly_block") return;
    setSaving(true);
    setError("");
    try {
      const payload = { ...drawer.draft, kind: "weekly_block", weekId };
      const response = await fetch("/api/objectives", {
        method: drawer.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Weekly block save failed.");
      setData(json.data ?? json);
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
      const response = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "bootstrap_demo", weekId })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Demo install failed.");
      setData(json.data ?? json);
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
      const query =
        drawer.type === "objective"
          ? `/api/objectives?id=${drawer.draft.id}&week_id=${weekId}`
          : `/api/objectives?id=${drawer.draft.id}&kind=weekly_block&week_id=${weekId}`;
      const response = await fetch(query, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Delete failed.");
      setData(json.data ?? json);
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
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Hierarchy</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-50">From direction to concrete week</h2>
              <p className="mt-2 text-sm text-slate-400">
                Read left to right: the yearly direction should become a quarter focus, then a month, then a week you can actually execute.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented>
                <SegmentedButton active={structureView === "map"} onClick={() => setStructureView("map")} type="button">
                  Map
                </SegmentedButton>
                <SegmentedButton active={structureView === "tree"} onClick={() => setStructureView("tree")} type="button">
                  Tree
                </SegmentedButton>
              </Segmented>
              <GhostButton onClick={() => openCreateObjective()} className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8">
                <CirclePlus className="h-4 w-4" />
                Add
              </GhostButton>
            </div>
          </div>
          {data.tree.length === 0 ? (
            <SoftPanel className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Start with a small objective tree</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Create a yearly direction, break it into quarter and month goals, then anchor the current week with projects and milestones.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {data.suggestedTemplates.map((template) => (
                  <div key={template.title} className="rounded-[18px] bg-white/[0.035] p-3 ring-1 ring-white/6">
                    <p className="text-sm font-semibold text-slate-100">{template.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{template.summary}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={() => void installDemo()} disabled={saving}>
                  <Sparkles className="h-4 w-4" />
                  Install starter structure
                </PrimaryButton>
                <SecondaryButton onClick={() => openCreateObjective()}>Create manually</SecondaryButton>
              </div>
            </SoftPanel>
          ) : structureView === "map" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {objectivesByHorizon.map((column) => (
                  <SoftPanel key={column.horizon} className="p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{column.horizon}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{horizonTitle(column.horizon)}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{horizonDescription(column.horizon)}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      {column.items.length} {column.items.length > 1 ? "items" : "item"}
                    </p>
                  </SoftPanel>
                ))}
              </div>

              <div className="space-y-4">
                {objectivePaths.map((path, pathIndex) => (
                  <SoftPanel key={path.key} className="p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Strategic path {pathIndex + 1}</p>
                        <p className="mt-1 truncate text-base font-semibold text-slate-50">
                          {path.leaf?.title ?? path.root?.title ?? "Objective path"}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {path.leaf?.nextAction || path.leaf?.summary || path.root?.summary || "Define the next concrete move for this branch."}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Pill>{path.totalLinkedTasks} tasks</Pill>
                        <Pill>{formatMinutes(path.totalWeeklyMinutes)} planned</Pill>
                      </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-4">
                      {(["year", "quarter", "month", "week"] as const).map((horizon, columnIndex, array) => {
                        const node = path.nodes[horizon];
                        return (
                          <div key={`${path.key}-${horizon}`} className="min-w-0">
                            <div className="mb-2 flex items-center gap-2">
                              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{horizon}</p>
                              {columnIndex < array.length - 1 ? <span className="text-xs text-slate-600">→</span> : null}
                            </div>
                            {node ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const objective = data.objectives.find((item) => item.id === node.id);
                                  if (objective) openEditObjective(objective);
                                }}
                                className="flex h-full min-h-[190px] w-full flex-col rounded-[20px] bg-white/[0.04] p-4 text-left ring-1 ring-white/6 transition hover:bg-white/[0.06]"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: node.color }} />
                                      <p className="truncate text-sm font-semibold text-slate-50">{node.title}</p>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">{horizonTitle(horizon)}</p>
                                  </div>
                                  <Pill className={priorityTone(node.priority)}>{node.priority}</Pill>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Pill className={kindTone(node.kind)}>{node.kind}</Pill>
                                  <Pill className={statusTone(node.status)}>{node.status.replace("_", " ")}</Pill>
                                </div>
                                <p className="mt-3 line-clamp-4 flex-1 text-sm leading-6 text-slate-300">
                                  {node.nextAction || node.summary || "Define the next concrete move."}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                                  <span>{node.linkedTasksCount} linked tasks</span>
                                  <span>{formatMinutes(node.weeklyMinutes)} planned</span>
                                </div>
                              </button>
                            ) : (
                              <div className="flex min-h-[190px] items-center rounded-[20px] bg-black/10 px-4 text-sm text-slate-500 ring-1 ring-dashed ring-white/8">
                                No {horizon} layer yet.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </SoftPanel>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.tree
                .filter((node): node is NonNullable<ObjectivesData["tree"][number]> => node != null)
                .map((node) => (
                <ObjectiveTreeNode
                  key={node.id}
                  node={node}
                  onEdit={(objectiveId) => {
                    const objective = data.objectives.find((item) => item.id === objectiveId);
                    if (objective) openEditObjective(objective);
                  }}
                  onCreateChild={openCreateObjective}
                />
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Execution</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-50">Next actions</h2>
              </div>
              <Pill>{data.nextActions.length} live</Pill>
            </div>
            <div className="space-y-3">
              {data.nextActions.length === 0 ? (
                <p className="text-sm text-slate-500">No active objectives yet.</p>
              ) : (
                data.nextActions.map((item) => (
                  <SoftPanel key={item.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-50">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{item.nextAction}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Pill className={priorityTone(item.priority)}>{item.priority}</Pill>
                        <Pill>{item.horizon}</Pill>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{item.linkedTasksCount} linked tasks</span>
                      <span>{formatMinutes(item.weeklyMinutes)} planned</span>
                    </div>
                  </SoftPanel>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Weekly allocation</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-50">Time by objective</h2>
            </div>
            <div className="space-y-3">
              {data.allocation.length === 0 ? (
                <p className="text-sm text-slate-500">No weekly blocks yet. Add a few planned blocks to see the weekly balance.</p>
              ) : (
                data.allocation.map((item) => {
                  const width = data.weekSummary.totalMinutes ? Math.max(8, Math.round((item.minutes / data.weekSummary.totalMinutes) * 100)) : 0;
                  return (
                    <div key={item.key} className="rounded-[18px] bg-white/[0.035] p-3 ring-1 ring-white/6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{item.dayCount} days worked · {item.blocks} blocks</p>
                        </div>
                        <Pill>{item.minutesLabel}</Pill>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: item.color }} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.daysWorked.map((day) => (
                          <Pill key={day} className="text-[11px]">{day.slice(5)}</Pill>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Week anticipation</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">Monday to Sunday planning</h2>
            <p className="mt-2 text-sm text-slate-400">
              Weekdays hold committed execution. Saturday and Sunday stay visible, but softer and more flexible.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-400">
            <span>Total load: {data.weekSummary.totalMinutesLabel}</span>
            <span>High-load days: {stats.highLoadDays}</span>
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-7">
          {data.weeklyDays.map((day) => (
            <div
              key={day.date}
              className={`flex min-h-[360px] flex-col rounded-[22px] p-3 ring-1 ${
                day.isWeekend ? "bg-white/[0.03] ring-white/5" : "bg-white/[0.04] ring-white/8"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{day.label}</p>
                  <p className="mt-1 text-base font-semibold text-slate-50">{day.date.slice(5)}</p>
                  <p className="mt-1 text-xs text-slate-500">{day.loadLabel}</p>
                </div>
                <GhostButton onClick={() => openCreateBlock(day.date)} className="min-h-9 rounded-2xl bg-white/[0.03] px-2.5 ring-1 ring-white/8">
                  <CirclePlus className="h-4 w-4" />
                </GhostButton>
              </div>

              {day.events.length > 0 ? (
                <div className="space-y-2">
                  {day.events.map((event) => (
                    <div key={event.id} className="rounded-[16px] bg-white/[0.03] px-3 py-2 ring-1 ring-white/6">
                      <p className="truncate text-xs font-semibold text-slate-200">{event.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{event.timeLabel} · {event.impact}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">{day.isWeekend ? "Weekend kept flexible." : "No calendar constraint."}</p>
              )}

              <div className="mt-3 flex-1 space-y-2">
                {day.blocks.length === 0 ? (
                  <div className="rounded-[16px] bg-black/10 px-3 py-6 text-center text-sm text-slate-500 ring-1 ring-white/5">
                    No planned block.
                  </div>
                ) : (
                  day.blocks.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => openEditBlock(block)}
                      className="w-full rounded-[18px] bg-white/[0.04] p-3 text-left ring-1 ring-white/6 transition hover:bg-white/[0.06]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">{block.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {block.startTime && block.endTime ? `${block.startTime} - ${block.endTime}` : "Flexible timing"} · {formatDuration(block.durationMinutes)}
                          </p>
                        </div>
                        <Pill>{block.category}</Pill>
                      </div>
                      {block.objectiveTitle ? (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/8">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: block.objectiveColor ?? "#8da2fb" }} />
                          {block.objectiveTitle}
                        </div>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Drawer
        open={drawer != null}
        title={
          drawer?.type === "objective"
            ? drawer.mode === "edit" ? "Edit objective" : "Add objective"
            : drawer?.mode === "edit" ? "Edit weekly block" : "Add weekly block"
        }
        description={
          drawer?.type === "objective"
            ? "Keep strategy readable: one title, one next action, one horizon."
            : "Plan only the blocks that genuinely matter this week."
        }
        onClose={() => setDrawer(null)}
        width="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            {drawer?.mode === "edit" ? (
              <GhostButton onClick={() => void deleteCurrent()} className="rounded-2xl bg-risk/10 px-3 text-risk ring-1 ring-risk/15">
                <Trash2 className="h-4 w-4" />
                Delete
              </GhostButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <SecondaryButton onClick={() => setDrawer(null)}>Cancel</SecondaryButton>
              <PrimaryButton
                form={drawer?.type === "objective" ? "objective-form" : "weekly-block-form"}
                type="submit"
                disabled={
                  saving ||
                  (drawer?.type === "objective" ? !drawer.draft.title.trim() : !drawer?.draft.title.trim())
                }
              >
                {saving ? "Saving..." : drawer?.mode === "edit" ? "Save" : "Create"}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        {drawer?.type === "objective" ? (
          <form id="objective-form" onSubmit={saveObjective} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={drawer.draft.title}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)}
                  className="mt-2"
                  placeholder="What matters here?"
                />
              </div>
              <div>
                <FieldLabel>Kind</FieldLabel>
                <SelectInput
                  value={drawer.draft.kind}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, kind: event.target.value as ObjectiveDraft["kind"] } } : current)}
                  className="mt-2 w-full"
                >
                  {objectiveKinds.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Horizon</FieldLabel>
                <SelectInput
                  value={drawer.draft.horizon}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, horizon: event.target.value as ObjectiveDraft["horizon"] } } : current)}
                  className="mt-2 w-full"
                >
                  {objectiveHorizons.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <SelectInput
                  value={drawer.draft.status}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, status: event.target.value as ObjectiveDraft["status"] } } : current)}
                  className="mt-2 w-full"
                >
                  {objectiveStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Priority</FieldLabel>
                <SelectInput
                  value={drawer.draft.priority}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, priority: event.target.value as ObjectiveDraft["priority"] } } : current)}
                  className="mt-2 w-full"
                >
                  {objectivePriorities.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Parent</FieldLabel>
                <SelectInput
                  value={drawer.draft.parentId}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, parentId: event.target.value } } : current)}
                  className="mt-2 w-full"
                >
                  <option value="">No parent</option>
                  {objectiveOptions
                    .filter((item) => item.id !== drawer.draft.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · {item.horizon}
                      </option>
                    ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Target date</FieldLabel>
                <TextInput
                  type="date"
                  value={drawer.draft.targetDate}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, targetDate: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>Week anchor</FieldLabel>
                <TextInput
                  value={drawer.draft.weekId}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, weekId: event.target.value } } : current)}
                  className="mt-2"
                  placeholder="2026-W26"
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Summary</FieldLabel>
                <TextArea
                  value={drawer.draft.summary}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, summary: event.target.value } } : current)}
                  className="mt-2 min-h-[96px]"
                  placeholder="Why does this matter?"
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Next action</FieldLabel>
                <TextArea
                  value={drawer.draft.nextAction}
                  onChange={(event) => setDrawer((current) => current && current.type === "objective" ? { ...current, draft: { ...current.draft, nextAction: event.target.value } } : current)}
                  className="mt-2 min-h-[84px]"
                  placeholder="What is the very next concrete move?"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <FieldLabel>Linked tasks</FieldLabel>
                <Pill>{drawer.draft.linkedTaskIds.length} selected</Pill>
              </div>
              <div className="grid gap-2 rounded-[22px] bg-white/[0.03] p-3 ring-1 ring-white/6">
                {data.taskOptions.length === 0 ? (
                  <p className="text-sm text-slate-500">No tasks available yet. Add a few tasks, then link them back to this objective.</p>
                ) : (
                  data.taskOptions.map((task) => {
                    const checked = drawer.draft.linkedTaskIds.includes(task.id);
                    return (
                      <label key={task.id} className="flex items-start gap-3 rounded-[18px] bg-white/[0.03] px-3 py-2 ring-1 ring-white/6">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setDrawer((current) =>
                              current && current.type === "objective"
                                ? {
                                    ...current,
                                    draft: {
                                      ...current.draft,
                                      linkedTaskIds: event.target.checked
                                        ? [...current.draft.linkedTaskIds, task.id]
                                        : current.draft.linkedTaskIds.filter((item) => item !== task.id)
                                    }
                                  }
                                : current
                            )
                          }
                          className="mt-1 h-4 w-4 accent-accent"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-100">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {task.date} · {task.importance} · {task.status} · {formatDuration(task.estimatedMinutes)}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </form>
        ) : drawer?.type === "weekly_block" ? (
          <form id="weekly-block-form" onSubmit={saveWeeklyBlock} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={drawer.draft.title}
                  onChange={(event) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)}
                  className="mt-2"
                  placeholder="Focused work block, training, review..."
                />
              </div>
              <div>
                <FieldLabel>Objective / project</FieldLabel>
                <SelectInput
                  value={drawer.draft.objectiveId}
                  onChange={(event) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, objectiveId: event.target.value } } : current)}
                  className="mt-2 w-full"
                >
                  <option value="">Unlinked block</option>
                  {objectiveOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <SelectInput
                  value={drawer.draft.category}
                  onChange={(event) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, category: event.target.value as WeeklyBlockDraft["category"] } } : current)}
                  className="mt-2 w-full"
                >
                  {weeklyPlanCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Date</FieldLabel>
                <TextInput
                  type="date"
                  value={drawer.draft.date}
                  onChange={(event) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, date: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>Flexible</FieldLabel>
                <label className="mt-2 flex h-11 items-center gap-3 rounded-2xl bg-white/[0.03] px-3.5 text-sm text-slate-200 ring-1 ring-white/8">
                  <input
                    type="checkbox"
                    checked={drawer.draft.flexible}
                    onChange={(event) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, flexible: event.target.checked } } : current)}
                    className="h-4 w-4 accent-accent"
                  />
                  This block can move if the week changes
                </label>
              </div>
              <div>
                <FieldLabel>Start time</FieldLabel>
                <TextInput
                  type="time"
                  value={drawer.draft.startTime}
                  onChange={(event) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, startTime: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>End time</FieldLabel>
                <TextInput
                  type="time"
                  value={drawer.draft.endTime}
                  onChange={(event) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, endTime: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
              <DurationInput
                label="Planned duration"
                value={drawer.draft.durationMinutes}
                onChange={(durationMinutes) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, durationMinutes } } : current)}
                showStored={false}
              />
              <div className="md:col-span-2">
                <FieldLabel>Note</FieldLabel>
                <TextArea
                  value={drawer.draft.note}
                  onChange={(event) => setDrawer((current) => current && current.type === "weekly_block" ? { ...current, draft: { ...current.draft, note: event.target.value } } : current)}
                  className="mt-2 min-h-[84px]"
                  placeholder="Optional note, constraints, or success condition."
                />
              </div>
            </div>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function ObjectiveTreeNode({
  node,
  onEdit,
  onCreateChild,
  depth = 0
}: {
  node: NonNullable<ObjectivesData["tree"][number]>;
  onEdit: (objectiveId: string) => void;
  onCreateChild: (parentId: string) => void;
  depth?: number;
}) {
  const defaultOpen = depth < 2;
  return (
    <details open={defaultOpen} className="rounded-[22px] bg-white/[0.03] p-3 ring-1 ring-white/6">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: node.color }} />
            <p className="truncate text-sm font-semibold text-slate-50">{node.title}</p>
            <Pill>{node.horizon}</Pill>
            <Pill className={kindTone(node.kind)}>{node.kind}</Pill>
            <Pill className={statusTone(node.status)}>{node.status}</Pill>
            <Pill className={priorityTone(node.priority)}>{node.priority}</Pill>
          </div>
          {node.summary ? <p className="mt-2 line-clamp-2 text-sm text-slate-400">{node.summary}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill>{node.weeklyMinutes ? formatMinutes(node.weeklyMinutes) : "0m"}</Pill>
          <GhostButton
            onClick={(event) => {
              event.preventDefault();
              onCreateChild(node.id);
            }}
            className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8"
          >
            <CirclePlus className="h-4 w-4" />
          </GhostButton>
          <GhostButton
            onClick={(event) => {
              event.preventDefault();
              onEdit(node.id);
            }}
            className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8"
          >
            <PencilLine className="h-4 w-4" />
          </GhostButton>
        </div>
      </summary>

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-[18px] bg-black/10 px-3 py-3 ring-1 ring-white/5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Next action</p>
              <span className="text-xs text-slate-500">{node.linkedTasksCount} tasks linked</span>
            </div>
            <p className="text-sm text-slate-300">{node.nextAction || "Define the next concrete move."}</p>
          </div>
          <div className="grid gap-2 md:min-w-[180px]">
            <MiniStat label="Completion" value={`${node.completionPercent}%`} />
            <MiniStat label="Blocks" value={String(node.weeklyBlocksCount)} />
          </div>
        </div>

        {node.linkedTasks.length > 0 ? (
          <div className="rounded-[18px] bg-white/[0.03] p-3 ring-1 ring-white/6">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              <Link2 className="h-3.5 w-3.5" />
              Linked tasks
            </div>
            <div className="space-y-2">
              {node.linkedTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-black/10 px-3 py-2 ring-1 ring-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.date} · {task.status}</p>
                  </div>
                  <Pill>{task.completionPercent}%</Pill>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {node.children.length > 0 ? (
          <div className="space-y-3 border-l border-white/8 pl-4">
            {node.children.map((child) => (
              <ObjectiveTreeNode key={child.id} node={child} onEdit={onEdit} onCreateChild={onCreateChild} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-white/[0.03] px-3 py-2 text-right ring-1 ring-white/6">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

type ObjectiveMapNode = ObjectivesData["objectives"][number];
type ObjectivePath = {
  key: string;
  root: ObjectiveMapNode | null;
  leaf: ObjectiveMapNode | null;
  nodes: Record<"year" | "quarter" | "month" | "week", ObjectiveMapNode | null>;
  totalLinkedTasks: number;
  totalWeeklyMinutes: number;
};

function buildObjectivePaths(tree: ObjectivesData["tree"]): ObjectivePath[] {
  const paths: ObjectivePath[] = [];

  function walk(
    node: NonNullable<ObjectivesData["tree"][number]>,
    lineage: Partial<Record<"year" | "quarter" | "month" | "week", ObjectiveMapNode>>
  ) {
    const nextLineage = {
      ...lineage,
      [node.horizon]: {
        id: node.id,
        parentId: node.parentId,
        title: node.title,
        summary: node.summary,
        nextAction: node.nextAction,
        kind: node.kind,
        horizon: node.horizon,
        status: node.status,
        priority: node.priority,
        targetDate: node.targetDate,
        weekId: node.weekId,
        color: node.color,
        sortOrder: node.sortOrder,
        archived: node.archived,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        linkedTaskIds: node.linkedTasks.map((task) => task.id),
        linkedTasksCount: node.linkedTasksCount,
        weeklyMinutes: node.weeklyMinutes
      }
    };

    const relevantChildren = node.children;

    if (relevantChildren.length === 0) {
      const nodes = {
        year: nextLineage.year ?? null,
        quarter: nextLineage.quarter ?? null,
        month: nextLineage.month ?? null,
        week: nextLineage.week ?? null
      };
      const usedNodes = Object.values(nodes).filter((item): item is ObjectiveMapNode => item != null);
      paths.push({
        key: usedNodes.map((item) => item.id).join(":"),
        root: usedNodes[0] ?? null,
        leaf: usedNodes[usedNodes.length - 1] ?? null,
        nodes,
        totalLinkedTasks: usedNodes.reduce((sum, item) => sum + item.linkedTasksCount, 0),
        totalWeeklyMinutes: usedNodes.reduce((sum, item) => sum + item.weeklyMinutes, 0)
      });
      return;
    }

    for (const child of relevantChildren) {
      walk(child, nextLineage);
    }
  }

  tree
    .filter((node): node is NonNullable<ObjectivesData["tree"][number]> => node != null)
    .forEach((node) => walk(node, {}));

  return paths;
}

function horizonTitle(horizon: string) {
  if (horizon === "year") return "North star";
  if (horizon === "quarter") return "Strategic bet";
  if (horizon === "month") return "Deliverable";
  return "Execution layer";
}

function horizonDescription(horizon: string) {
  if (horizon === "year") return "The outcome that defines the direction of the year.";
  if (horizon === "quarter") return "The main focus that should receive most of the quarter's energy.";
  if (horizon === "month") return "A concrete result you want visible by month end.";
  return "What is actually scheduled, shipped, reviewed, or protected this week.";
}

function statusTone(status: string) {
  if (status === "done") return "bg-good/10 text-good ring-good/15";
  if (status === "at_risk") return "bg-risk/10 text-risk ring-risk/15";
  if (status === "active" || status === "on_track") return "bg-white/[0.06] text-slate-200 ring-white/10";
  return "bg-white/[0.03] text-slate-400 ring-white/8";
}

function priorityTone(priority: string) {
  if (priority === "critical") return "bg-risk/10 text-risk ring-risk/15";
  if (priority === "high") return "bg-warn/10 text-warn ring-warn/15";
  return "bg-white/[0.03] text-slate-400 ring-white/8";
}

function kindTone(kind: string) {
  if (kind === "project") return "bg-accent/12 text-accent ring-accent/15";
  if (kind === "milestone") return "bg-good/10 text-good ring-good/15";
  return "bg-white/[0.03] text-slate-400 ring-white/8";
}
