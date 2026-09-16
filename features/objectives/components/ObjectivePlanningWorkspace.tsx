"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Card, Drawer, GhostButton, ProgressBar, SecondaryButton, Segmented, SegmentedButton, TextInput } from "@/components/ui";
import { loadPlanning, savePlanning, savePlanningTask } from "../api/planningApi";
import type { ObjectivesData, ObjectiveSummary, WeeklyPlanBlock } from "../domain/objective";
import type { PlanningData, PlanningMutation } from "../domain/planning";
import { shiftMonth } from "../domain/planning";
import { ObjectiveAnalytics } from "./ObjectiveAnalytics";
import { ObjectiveExecutionLog } from "./ObjectiveExecutionLog";
import { ObjectiveHourlyCalendar } from "./ObjectiveHourlyCalendar";
import { ObjectiveMonthlyRoadmap } from "./ObjectiveMonthlyRoadmap";
import { ObjectivePlanningDetails } from "./ObjectivePlanningDetails";

const VIEWS = ["Overview", "Weekly", "Monthly", "Execution", "Analytics"] as const;

type Props = {
  data: ObjectivesData;
  overview: (onInspect: (id: string) => void) => ReactNode;
  onRefresh: () => Promise<void>;
  onCreateBlock: (date: string, objectiveId?: string, startTime?: string) => void;
  onEditBlock: (block: WeeklyPlanBlock) => void;
  onLogBlock: (block: WeeklyPlanBlock) => void;
  onEditObjective: (objective: ObjectiveSummary) => void;
  onMilestone: (parentId: string, date: string) => void;
};

export function ObjectivePlanningWorkspace({ data, overview, onRefresh, onCreateBlock, onEditBlock, onLogBlock, onEditObjective, onMilestone }: Props) {
  const [view, setView] = useState<(typeof VIEWS)[number]>("Overview");
  const [month, setMonth] = useState(data.weekDays[0].slice(0, 7));
  const [planning, setPlanning] = useState<PlanningData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [detailsId, setDetailsId] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const mutationLock = useRef(false);

  useEffect(() => { setMonth(data.weekDays[0].slice(0, 7)); }, [data.weekDays[0]]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadPlanning(month, controller.signal).then((response) => { if (!controller.signal.aborted) setPlanning(response); }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load planning.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [data, month, revision]);

  async function mutate(operation: () => Promise<void>): Promise<boolean> {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      await operation();
      await onRefresh();
      setRevision((current) => current + 1);
      setNotice("Changes saved.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save planning.");
      return false;
    } finally {
      mutationLock.current = false; setBusy(false);
    }
  }
  const onSave = (mutation: PlanningMutation) => mutate(() => savePlanning(mutation));
  const onTaskSave = (payload: Parameters<typeof savePlanningTask>[0]) => mutate(() => savePlanningTask(payload));
  const detailObjective = data.objectives.find((objective) => objective.id === detailsId);
  const detailInsight = planning?.insights.find((insight) => insight.objectiveId === detailsId);
  const visibleObjectives = data.objectives.filter((objective) => objective.title.toLowerCase().includes(query.toLowerCase()));
  function inspect(id: string) { setSelectedId(id); setDetailsId(id); }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><Segmented>{VIEWS.map((name) => <SegmentedButton key={name} active={view === name} onClick={() => setView(name)}>{name}</SegmentedButton>)}</Segmented><SecondaryButton disabled={!data.objectives.length} onClick={() => setDetailsId(selectedId || data.objectives[0]?.id || "")}>Objective details</SecondaryButton></div>
    {error ? <div role="alert" className="rounded-2xl bg-risk/10 px-4 py-3 text-sm text-risk">{error}<button className="focus-ring ml-3 underline" onClick={() => setRevision((current) => current + 1)}>Retry</button></div> : null}
    {notice ? <p role="status" className="text-xs text-good">{notice}</p> : null}
    {view === "Overview" ? overview(inspect) : <>
      {view !== "Weekly" ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 rounded-2xl bg-panel2 p-1"><GhostButton aria-label="Previous month" disabled={loading || busy} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></GhostButton><span className="px-2 text-sm font-medium">{new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`))}</span><GhostButton aria-label="Next month" disabled={loading || busy} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="h-4 w-4" /></GhostButton></div><SecondaryButton disabled={loading || busy} onClick={() => setMonth(planning?.today.slice(0, 7) ?? month)}>Current month</SecondaryButton></div> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[230px_minmax(0,1fr)]">
        <Card className="xl:sticky xl:top-4"><h2 className="mb-3 text-sm font-semibold">Objectives</h2><TextInput aria-label="Filter objectives" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an objective" /><button className={`focus-ring my-3 w-full rounded-xl px-3 py-2 text-left text-xs ${!selectedId ? "bg-accent/10 text-accent" : "text-muted"}`} onClick={() => setSelectedId("")}>All objectives</button><div className="max-h-48 space-y-2 overflow-y-auto xl:max-h-[530px]">{visibleObjectives.map((objective) => {
          const insight = planning?.insights.find((item) => item.objectiveId === objective.id);
          return <button key={objective.id} onClick={() => inspect(objective.id)} aria-pressed={selectedId === objective.id} className={`focus-ring w-full rounded-2xl p-3 text-left ${selectedId === objective.id ? "bg-accent/10 ring-1 ring-accent/30" : "bg-panel2/60"}`}><span className="block text-sm font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: objective.color }} />{objective.title}</span><span className="mb-2 mt-1 block text-[11px] text-muted">{objective.horizon} · {objective.priority} · {insight?.progress ?? 0}%</span><ProgressBar value={insight?.progress ?? 0} /></button>;
        })}</div></Card>
        <div className="min-w-0">{loading ? <Card><p role="status" className="text-sm text-muted">Loading planning…</p></Card> : planning ? <>
          {view === "Weekly" ? <ObjectiveHourlyCalendar data={data} objectiveId={selectedId} objectiveIds={planning.insights.find((insight) => insight.objectiveId === selectedId)?.objectiveIds ?? []} onCreateBlock={onCreateBlock} onEditBlock={onEditBlock} /> : null}
          {view === "Monthly" ? <ObjectiveMonthlyRoadmap objectives={data.objectives} planning={planning} selectedId={selectedId} onSelect={inspect} onMilestone={onMilestone} /> : null}
          {view === "Execution" ? <ObjectiveExecutionLog planning={planning} selectedId={selectedId} busy={busy} onLog={onLogBlock} onSave={onSave} /> : null}
          {view === "Analytics" ? <ObjectiveAnalytics objectives={data.objectives} planning={planning} selectedId={selectedId} busy={busy} onSelect={inspect} onSave={onSave} onCreateBlock={onCreateBlock} onMilestone={onMilestone} /> : null}
        </> : null}</div>
      </div>
    </>}
    <Drawer open={!!detailObjective && !!detailInsight} title={detailObjective?.title ?? "Objective details"} onClose={() => setDetailsId("")}>
      {detailObjective && detailInsight && planning ? <ObjectivePlanningDetails key={`${detailObjective.id}:${detailInsight.progress}:${detailInsight.effortMinutes}:${detailInsight.impact}:${detailInsight.startDate}:${detailInsight.progressMode}`} objective={detailObjective} insight={detailInsight} planning={planning} objectives={data.objectives} busy={busy} onSave={onSave} onTaskSave={onTaskSave} onSelect={inspect} onEdit={(objective) => { setDetailsId(""); onEditObjective(objective); }} onCreateBlock={(date, objectiveId) => { setDetailsId(""); onCreateBlock(date, objectiveId); }} onEditBlock={(block) => { setDetailsId(""); onEditBlock(block); }} /> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-risk">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 text-xs text-good">{notice}</p> : null}
    </Drawer>
  </div>;
}
