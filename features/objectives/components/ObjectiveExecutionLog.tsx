"use client";

import { useState, type FormEvent } from "react";
import { Card, FieldLabel, Metric, Pill, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";
import type { WeeklyPlanBlock } from "../domain/objective";
import type { PlanningBlock, PlanningData, PlanningMutation } from "../domain/planning";
import { hours } from "../domain/planning";

type Props = {
  planning: PlanningData;
  selectedId: string;
  busy: boolean;
  onLog: (block: WeeklyPlanBlock) => void;
  onSave: (mutation: PlanningMutation) => Promise<boolean>;
};

export function ObjectiveExecutionLog({ planning, selectedId, busy, onLog, onSave }: Props) {
  const [filter, setFilter] = useState("all");
  const [recovering, setRecovering] = useState<PlanningBlock | null>(null);
  const objectiveIds = planning.insights.find((insight) => insight.objectiveId === selectedId)?.objectiveIds ?? [];
  const blocks = planning.blocks.filter((block) => (!selectedId || (block.objectiveId !== null && objectiveIds.includes(block.objectiveId))) && (filter === "all" || block.executionStatus === filter));
  const planned = blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
  const actual = blocks.reduce((sum, block) => sum + (block.actualMinutes ?? 0), 0);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Planned" value={hours(planned)} /><Metric label="Recorded" value={hours(actual)} /><Metric label="Awaiting log" value={String(blocks.filter((block) => block.date <= planning.today && block.executionStatus === "planned").length)} detail="Unlogged time is not treated as missed" /></div>
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Execution log</h2><div className="flex flex-wrap gap-1">{["all", "planned", "done", "partial", "not_done"].map((value) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`focus-ring rounded-xl px-3 py-2 text-xs ${filter === value ? "bg-accent/15 text-accent" : "text-muted"}`}>{value.replaceAll("_", " ")}</button>)}</div></div>
      <div className="thin-scrollbar overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="text-xs text-muted"><th className="pb-3 font-normal">Block / objective</th><th className="pb-3 font-normal">Planned → actual</th><th className="pb-3 font-normal">Result</th><th className="pb-3 font-normal">Action</th></tr></thead><tbody>
        {blocks.map((block) => <tr key={block.id} className="border-t border-line"><td className="py-4 pr-4"><p className="font-medium">{block.title}</p><p className="mt-1 text-xs text-muted">{block.date} · {block.objectiveTitle ?? "Unassigned"}</p></td><td className="pr-3">{hours(block.durationMinutes)} → {block.actualMinutes === null ? "—" : hours(block.actualMinutes)}<div className="mt-2 flex h-1 w-24 overflow-hidden rounded-full bg-line"><span className="bg-accent" style={{ width: `${Math.min(100, 100 * (block.actualMinutes ?? 0) / Math.max(1, block.durationMinutes))}%` }} /></div></td><td className="pr-3"><Pill>{block.executionStatus.replaceAll("_", " ")}</Pill>{block.recoveryAction ? <p className="mt-2 text-xs text-muted">{block.recoveryAction === "replan" ? "Replanned" : "No recovery requested"}</p> : null}</td><td className="py-3"><div className="flex flex-wrap gap-2"><SecondaryButton disabled={busy || block.date > planning.today} onClick={() => onLog(block)}>{block.executionStatus === "planned" ? "Log" : "Correct"}</SecondaryButton>{["partial", "not_done"].includes(block.executionStatus) && !block.recoveryAction ? <SecondaryButton disabled={busy} onClick={() => setRecovering(block)}>Review impact</SecondaryButton> : null}</div></td></tr>)}
      </tbody></table></div>
      {!blocks.length ? <p className="py-6 text-sm text-muted">No blocks match this month and filter. Plan a block or change the period.</p> : null}
    </Card>
    {recovering ? <RecoveryReview key={recovering.id} block={recovering} planning={planning} busy={busy} onClose={() => setRecovering(null)} onSave={onSave} /> : null}
  </div>;
}

function RecoveryReview({ block, planning, busy, onClose, onSave }: { block: PlanningBlock; planning: PlanningData; busy: boolean; onClose: () => void; onSave: Props["onSave"] }) {
  const [date, setDate] = useState(planning.today);
  const [minutes, setMinutes] = useState(Math.max(1, block.durationMinutes - (block.actualMinutes ?? 0)));
  const insight = planning.insights.find((item) => item.objectiveId === block.objectiveId);
  async function replan(event: FormEvent) {
    event.preventDefault();
    if (await onSave({ path: "recovery", method: "POST", body: { blockId: block.id, action: "replan", date, durationMinutes: minutes } })) onClose();
  }
  return <Card><h3 className="font-semibold">Recovery review · {block.title}</h3><p className="mt-2 text-sm text-muted">A missed block creates no automatic debt. Replan only the useful work that remains.</p>
    <p className="mt-3 text-sm">{insight?.gap !== null && insight?.gap !== undefined ? insight.gap >= -10 ? "The objective is close to its planned trajectory. No automatic recovery is suggested." : `The objective is ${Math.abs(insight.gap)} points behind its planned trajectory.${insight.slipDays !== null ? ` Current forecast: ${Math.max(0, insight.slipDays)} days beyond the deadline.` : " More progress observations are needed to forecast a date."}` : "There is not enough deadline and progress information to estimate the impact."}</p>
    <p className="mt-2 text-xs text-muted">The trajectory describes the objective as a whole; it does not attribute a delay to this block alone.</p>
    <form onSubmit={(event) => void replan(event)} className="mt-4 flex flex-wrap items-end gap-3"><FieldLabel className="flex-1">New date<TextInput aria-label="Recovery date" type="date" required min={planning.today} value={date} onChange={(event) => setDate(event.target.value)} /></FieldLabel><FieldLabel className="flex-1">Useful work remaining (min)<TextInput aria-label="Recovery minutes" type="number" required min={1} max={1440} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></FieldLabel><PrimaryButton disabled={busy} type="submit">Replan</PrimaryButton><SecondaryButton disabled={busy} type="button" onClick={async () => { if (await onSave({ path: "recovery", method: "POST", body: { blockId: block.id, action: "ignore" } })) onClose(); }}>Ignore</SecondaryButton><SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton></form>
  </Card>;
}
