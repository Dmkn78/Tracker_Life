"use client";

import { useState } from "react";
import { Card, FieldLabel, Metric, Pill, PrimaryButton, ProgressBar, SecondaryButton, SelectInput, SoftPanel, TextInput } from "@/components/ui";
import type { ObjectiveSummary } from "../domain/objective";
import type { ObjectiveInsight, PlanningData, PlanningMutation } from "../domain/planning";
import { hours, signed } from "../domain/planning";
import { ObjectiveRecoverySchedule } from "./ObjectiveRecoverySchedule";

type Props = {
  objectives: ObjectiveSummary[];
  planning: PlanningData;
  selectedId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onSave: (mutation: PlanningMutation) => Promise<boolean>;
  onCreateBlock: (date: string, objectiveId?: string) => void;
  onMilestone: (parentId: string, date: string) => void;
};

export function ObjectiveAnalytics({ objectives, planning, selectedId, busy, onSelect, onSave, onCreateBlock, onMilestone }: Props) {
  const rows = planning.insights.filter((insight) => !selectedId || insight.objectiveId === selectedId);
  const selected = rows.find((insight) => insight.objectiveId === selectedId) ?? rows[0];
  const roots = planning.insights.filter((insight) => {
    const objective = objectives.find((item) => item.id === insight.objectiveId);
    return objective && (!objective.parentId || !objectives.some((item) => item.id === objective.parentId));
  });
  return <div className="space-y-4">
    <Card><div className="mb-4 flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Decision center</h2><p className="text-xs text-muted">Current trajectory as of {planning.today}</p></div>
      <div className="grid gap-3 lg:grid-cols-2">{planning.recommendations.map((recommendation) => {
        const objective = objectives.find((item) => item.id === recommendation.objectiveId);
        const insight = planning.insights.find((item) => item.objectiveId === recommendation.objectiveId);
        if (!objective || !insight) return null;
        return <SoftPanel key={objective.id}><button className="focus-ring text-left text-sm font-semibold" onClick={() => onSelect(objective.id)}>{objective.title}</button><p className="mt-2 text-sm text-muted">{recommendation.reason === "behind" ? `${Math.abs(insight.gap ?? 0)} points behind the expected trajectory.` : recommendation.reason === "decompose" ? "Break this objective into a concrete deliverable and a next action." : "No work blocks are allocated in the selected month."}</p>{recommendation.reason === "behind" && insight.recoveryMinutes ? <p className="mt-2 text-xs text-muted">Planning scenario: {insight.recoveryDailyMinutes} extra min/day over {insight.recoveryDays} days, based on your effort estimate. This is a workload estimate, not a guaranteed recovery.</p> : null}<div className="mt-3 flex flex-wrap gap-2"><SecondaryButton disabled={busy} onClick={() => onSelect(objective.id)}>Review</SecondaryButton>{recommendation.reason === "decompose" ? <SecondaryButton onClick={() => onMilestone(objective.id, objective.targetDate ?? planning.today)}>Add milestone</SecondaryButton> : <SecondaryButton onClick={() => onCreateBlock(planning.today, objective.id)}>Plan work</SecondaryButton>}<SecondaryButton disabled={busy} onClick={() => void onSave({ path: "decision", method: "POST", body: { objectiveId: objective.id, action: "ignore" } })}>Dismiss for 7 days</SecondaryButton></div></SoftPanel>;
      })}</div>
      {!planning.recommendations.length ? <p className="text-sm text-muted">No active recommendation. Continue logging progress to make the next review useful.</p> : null}
    </Card>
    <Card><h2 className="mb-4 font-semibold">Deadline & velocity</h2><div className="thin-scrollbar overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs text-muted"><tr>{["Objective", "Actual / expected", "Velocity / required", "Forecast / deadline", "Slip", "Health"].map((label) => <th key={label} className="pb-3 pr-4 font-normal">{label}</th>)}</tr></thead><tbody>{rows.map((insight) => {
      const objective = objectives.find((item) => item.id === insight.objectiveId);
      return <tr key={insight.objectiveId} className="border-t border-line"><td className="py-4 pr-4"><button className="focus-ring text-left font-medium" onClick={() => onSelect(insight.objectiveId)}>{objective?.title}</button><p className="mt-1 text-xs text-muted">{objective?.status.replaceAll("_", " ")}</p></td><td className="pr-4">{insight.progress}% / {insight.expectedProgress === null ? "—" : `${insight.expectedProgress}%`}<div className="mt-2 w-24"><ProgressBar value={insight.progress} /></div></td><td className="pr-4">{insight.velocity ?? "—"} / {insight.requiredVelocity ?? "—"}<p className="mt-1 text-xs text-muted">points/week · momentum {signed(insight.momentum)}</p></td><td className="pr-4">{insight.forecastDate ?? "Insufficient history"}<p className="mt-1 text-xs text-muted">Due {objective?.targetDate ?? "not set"}</p></td><td className={insight.slipDays !== null && insight.slipDays > 0 ? "pr-4 text-warn" : "pr-4 text-muted"}>{signed(insight.slipDays, "d")}</td><td>{insight.health === null ? "—" : `${insight.health}/100`}</td></tr>;
    })}</tbody></table></div><p className="mt-4 text-xs leading-5 text-muted">Velocity uses progress observations at least 7 days apart; momentum compares the prior interval. Health averages deadline alignment (100 minus the progress gap, capped at 100) and the completion rate of logged blocks over 14 days. Missing components are excluded. Unlogged blocks are not failures.</p></Card>
    <div className="grid gap-4 xl:grid-cols-2"><ResourceAllocation roots={roots} objectives={objectives} month={planning.month} /><ValueEffortChart roots={roots} objectives={objectives} onSelect={onSelect} /></div>
    {selected ? <>
      <div className="grid gap-4 xl:grid-cols-2"><ProgressTrajectory insight={selected} title={objectives.find((item) => item.id === selected.objectiveId)?.title ?? "Objective"} /><CriticalPath insight={selected} /></div>
      <PlanningActions key={selected.objectiveId} insight={selected} planning={planning} busy={busy} onSave={onSave} />
    </> : <Card><p className="text-sm text-muted">Add an objective to begin tracking execution and forecasting.</p></Card>}
  </div>;
}

function ResourceAllocation({ roots, objectives, month }: { roots: ObjectiveInsight[]; objectives: ObjectiveSummary[]; month: string }) {
  const max = Math.max(1, ...roots.map((row) => Math.max(row.plannedMonthMinutes, row.actualMonthMinutes)));
  return <Card><h3 className="font-semibold">Resource allocation · {month}</h3><p className="mt-1 text-xs text-muted">Parent objectives include their children once.</p><div className="mt-4 space-y-4">{roots.map((row) => <div key={row.objectiveId}><div className="mb-2 flex justify-between gap-2 text-xs"><span>{objectives.find((item) => item.id === row.objectiveId)?.title}</span><span className="whitespace-nowrap text-muted">{hours(row.plannedMonthMinutes)} planned / {hours(row.actualMonthMinutes)} actual</span></div><div className="space-y-1"><div className="h-2 rounded-full bg-accent/25" style={{ width: `${100 * row.plannedMonthMinutes / max}%` }} /><div className="h-2 rounded-full bg-accent" style={{ width: `${100 * row.actualMonthMinutes / max}%` }} /></div></div>)}</div>{!roots.length ? <p className="mt-4 text-sm text-muted">No allocation yet.</p> : null}</Card>;
}

function ValueEffortChart({ roots, objectives, onSelect }: { roots: ObjectiveInsight[]; objectives: ObjectiveSummary[]; onSelect: (id: string) => void }) {
  const maxEffort = Math.max(2400, ...roots.map((row) => row.effortMinutes));
  return <Card><h3 className="font-semibold">Impact / effort</h3><p className="mt-1 text-xs text-muted">Your impact assessment versus estimated total effort.</p><div className="mt-5 grid grid-cols-2 text-[10px] uppercase tracking-wider text-muted"><span>High impact · lower effort</span><span className="text-right">High impact · higher effort</span></div><div className="relative mt-2 h-56 rounded-2xl border border-line bg-panel2/50"><div className="absolute inset-y-0 left-1/2 border-l border-dashed border-line" /><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />{roots.filter((row) => row.effortMinutes > 0).map((row) => {
    const objective = objectives.find((item) => item.id === row.objectiveId);
    return <button key={row.objectiveId} aria-label={`${objective?.title}: impact ${row.impact}/100, effort ${hours(row.effortMinutes)}`} title={`${objective?.title} · ${row.impact}/100 · ${hours(row.effortMinutes)}`} onClick={() => onSelect(row.objectiveId)} className="focus-ring absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel shadow-sm" style={{ left: `${5 + 90 * row.effortMinutes / maxEffort}%`, top: `${95 - 0.9 * row.impact}%`, backgroundColor: objective?.color ?? "rgb(var(--color-accent))" }} />;
  })}</div><div className="mt-2 flex justify-between text-xs text-muted"><span>0h · low impact</span><span>{hours(maxEffort)} · review effort</span></div><p className="mt-3 text-xs text-muted">Objectives without an effort estimate are omitted. Select a point to inspect its assumptions.</p></Card>;
}

function ProgressTrajectory({ insight, title }: { insight: ObjectiveInsight; title: string }) {
  const points = insight.history;
  const first = points.length ? new Date(`${points[0].date}T12:00:00`).getTime() : 0;
  const span = points.length ? Math.max(86400000, new Date(`${points[points.length - 1].date}T12:00:00`).getTime() - first) : 1;
  const coordinates = points.map((point) => `${20 + 440 * (new Date(`${point.date}T12:00:00`).getTime() - first) / span},${160 - 1.4 * point.progress}`).join(" ");
  return <Card><h3 className="font-semibold">Progress trajectory · {title}</h3>{points.length > 1 ? <><svg viewBox="0 0 480 180" role="img" aria-label={`${title}: ${points.map((point) => `${point.date}: ${point.progress}%`).join(", ")}`} className="mt-4 w-full"><path d="M20 20V160H460" fill="none" stroke="rgb(var(--color-line))" /><path d="M20 90H460" stroke="rgb(var(--color-line))" strokeDasharray="4 4" /><polyline points={coordinates} fill="none" stroke="rgb(var(--color-accent))" strokeWidth="3" /></svg><div className="flex justify-between text-xs text-muted"><span>{points[0].date}</span><span>{points[points.length - 1].date}</span></div></> : <p className="my-6 text-sm leading-6 text-muted">Log progress on different dates to reveal the trajectory. No historical progress has been invented.</p>}<div className="mt-4 grid grid-cols-2 gap-3"><Metric label="On-time simulation" value={insight.onTimeProbability === null ? "—" : `${insight.onTimeProbability}%`} /><Metric label="Observations" value={String(insight.observationCount)} /></div><p className="mt-3 text-xs leading-5 text-muted">The simulation resamples observed daily progress changes across 400 scenarios. It needs at least 7 consecutive-day changes within 28 days and a deadline within a year. It assumes recent conditions continue; this is an estimate, not a promise.</p></Card>;
}

function CriticalPath({ insight }: { insight: ObjectiveInsight }) {
  return <Card><h3 className="font-semibold">Critical path / PERT</h3><p className="mt-1 text-xs text-muted">Remaining work on the longest dependent chain.</p>{insight.network.tasks.length ? <><div className="my-4 flex items-center gap-2"><Pill>{hours(insight.network.totalMinutes)}</Pill>{insight.network.missingEstimates ? <span className="text-xs text-warn">Incomplete: {insight.network.missingEstimates} missing estimates</span> : <span className="text-xs text-muted">Critical tasks highlighted</span>}</div><div className="space-y-3">{insight.network.tasks.map((task) => <div key={task.id} className={`rounded-2xl border p-3 ${task.critical ? "border-accent/40 bg-accent/10" : "border-line bg-panel2/40"}`}><div className="flex justify-between gap-2 text-xs"><span className="font-medium">{task.title}</span><span>{hours(task.expectedMinutes)}</span></div><p className="mt-1 text-xs text-muted">{task.predecessorIds.length ? `After ${task.predecessorIds.map((id) => insight.network.tasks.find((item) => item.id === id)?.title ?? "task").join(", ")}` : "Ready to start"} · slack {hours(task.slackMinutes)}</p><div className="mt-2 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ marginLeft: `${100 * task.startMinutes / Math.max(1, insight.network.totalMinutes)}%`, width: `${100 * task.expectedMinutes / Math.max(1, insight.network.totalMinutes)}%` }} /></div></div>)}</div></> : <p className="my-6 text-sm text-muted">Add tasks and dependencies in objective details.</p>}<p className="mt-4 text-xs leading-5 text-muted">Expected effort = (optimistic + 4 × likely + pessimistic) / 6, adjusted for task completion. Independent tasks may run in parallel; one person’s total workload can be longer than this chain. Missing estimates prevent a reliable critical-path classification.</p></Card>;
}

function PlanningActions({ insight, planning, busy, onSave }: { insight: ObjectiveInsight; planning: PlanningData; busy: boolean; onSave: Props["onSave"] }) {
  const [effort, setEffort] = useState(insight.effortMinutes);
  const [blockId, setBlockId] = useState("");
  const blocks = planning.blocks.filter((block) => block.date >= planning.today && block.executionStatus === "planned" && block.objectiveId !== insight.objectiveId);
  return <Card><h3 className="font-semibold">Adjust the plan</h3><p className="mt-1 text-xs text-muted">Actions apply to the objective displayed in the trajectory above.</p><div className="mt-4 grid gap-4 lg:grid-cols-3"><SoftPanel><p className="text-sm font-medium">Accept the current forecast</p><p className="my-3 text-sm text-muted">{insight.forecastDate ?? "More progress history is needed."}</p><SecondaryButton disabled={busy || !insight.forecastDate} onClick={() => { if (insight.forecastDate) void onSave({ path: "decision", method: "POST", body: { objectiveId: insight.objectiveId, action: "accept_forecast", forecastDate: insight.forecastDate } }); }}>Set deadline to forecast</SecondaryButton></SoftPanel><SoftPanel><form onSubmit={async (event) => { event.preventDefault(); await onSave({ path: "decision", method: "POST", body: { objectiveId: insight.objectiveId, action: "reduce_scope", effortMinutes: effort } }); }}><FieldLabel>Reduced scope (total min)<TextInput aria-label="Reduced objective scope" type="number" required min={1} max={Math.max(1, insight.effortMinutes - 1)} value={effort} onChange={(event) => setEffort(Number(event.target.value))} /></FieldLabel><p className="my-2 text-xs text-muted">Update the estimate after removing unnecessary deliverables. Progress is not increased automatically.</p><SecondaryButton type="submit" disabled={busy || effort <= 0 || effort >= insight.effortMinutes}>Update scope</SecondaryButton></form></SoftPanel><SoftPanel><form onSubmit={async (event) => { event.preventDefault(); if (await onSave({ path: "reallocate", method: "POST", body: { objectiveId: insight.objectiveId, blockId } })) setBlockId(""); }}><FieldLabel>Reallocate a planned block<SelectInput aria-label="Block to reallocate" required value={blockId} onChange={(event) => setBlockId(event.target.value)}><option value="">Choose a block</option>{blocks.map((block) => <option key={block.id} value={block.id}>{block.date} · {block.title} · {hours(block.durationMinutes)} · {block.objectiveTitle ?? "Unassigned"}</option>)}</SelectInput></FieldLabel><p className="my-2 text-xs text-muted">Keeps the selected block’s date and duration. Changes its objective.</p><PrimaryButton type="submit" disabled={busy || !blockId}>Reallocate</PrimaryButton></form></SoftPanel></div><div className="mt-4"><ObjectiveRecoverySchedule insight={insight} today={planning.today} busy={busy} onSave={onSave} /></div></Card>;
}
