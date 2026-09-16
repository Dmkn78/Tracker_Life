"use client";

import { useState, type FormEvent } from "react";
import { FieldLabel, Metric, Pill, PrimaryButton, ProgressBar, SecondaryButton, SoftPanel, TextInput } from "@/components/ui";
import type { ObjectiveSummary, WeeklyPlanBlock } from "../domain/objective";
import type { ObjectiveInsight, PlanningData, PlanningMutation, PlanningTask } from "../domain/planning";
import { hours, signed } from "../domain/planning";
import type { savePlanningTask } from "../api/planningApi";

type Props = {
  objective: ObjectiveSummary;
  insight: ObjectiveInsight;
  planning: PlanningData;
  objectives: ObjectiveSummary[];
  busy: boolean;
  onSave: (mutation: PlanningMutation) => Promise<boolean>;
  onTaskSave: (payload: Parameters<typeof savePlanningTask>[0]) => Promise<boolean>;
  onEdit: (objective: ObjectiveSummary) => void;
  onCreateBlock: (date: string, objectiveId?: string) => void;
  onEditBlock: (block: WeeklyPlanBlock) => void;
  onSelect: (id: string) => void;
};

export function ObjectivePlanningDetails({ objective, insight, planning, objectives, busy, onSave, onTaskSave, onEdit, onCreateBlock, onEditBlock, onSelect }: Props) {
  const [startDate, setStartDate] = useState(insight.startDate);
  const [effort, setEffort] = useState(insight.effortMinutes);
  const [impact, setImpact] = useState(insight.impact);
  const [manual, setManual] = useState(insight.progressMode === "manual" ? String(insight.progress) : "");
  const [checkpointDate, setCheckpointDate] = useState(planning.today);
  const [checkpointProgress, setCheckpointProgress] = useState(insight.progress);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskMinutes, setTaskMinutes] = useState(60);
  const directTasks = planning.tasks.filter((task) => task.objectiveId === objective.id);
  const children = objectives.filter((item) => item.parentId === objective.id);
  const parent = objectives.find((item) => item.id === objective.parentId);
  async function settings(event: FormEvent) {
    event.preventDefault();
    await onSave({ path: "settings", method: "PATCH", body: { objectiveId: objective.id, startDate, effortMinutes: effort, impact, manualProgress: manual === "" ? null : Number(manual) } });
  }
  return <div className="space-y-5">
    <div><div className="flex flex-wrap gap-2"><Pill>{objective.status.replaceAll("_", " ")}</Pill><Pill>{objective.priority}</Pill><Pill>{objective.horizon}</Pill></div><p className="mt-4 text-sm leading-6 text-muted">{objective.summary || "Add a summary to describe the intended result."}</p>{parent ? <button onClick={() => onSelect(parent.id)} className="focus-ring mt-2 text-xs text-accent">Parent · {parent.title}</button> : null}</div>
    <div className="grid grid-cols-2 gap-3"><Metric label="Progress" value={`${insight.progress}%`} detail={insight.progressMode === "manual" ? "Manual observation" : "Tasks + milestones"} /><Metric label="Deadline" value={objective.targetDate ?? "Not set"} /><Metric label="Actual work" value={hours(insight.actualMinutes)} detail="Linked blocks, including child objectives" /><Metric label="Trajectory gap" value={signed(insight.gap, " pts")} /></div>
    <ProgressBar value={insight.progress} />
    <SoftPanel><p className="text-xs uppercase tracking-wider text-muted">Next action</p><p className="mt-2 text-sm">{objective.nextAction || "Define the next concrete step."}</p><div className="mt-3 flex flex-wrap gap-2"><SecondaryButton onClick={() => onEdit(objective)}>Edit objective</SecondaryButton><SecondaryButton onClick={() => onCreateBlock(planning.today, objective.id)}>Plan work</SecondaryButton></div></SoftPanel>
    {children.length ? <div><h3 className="mb-2 text-sm font-semibold">Milestones / sub-objectives</h3><div className="space-y-2">{children.map((child) => <button key={child.id} onClick={() => onSelect(child.id)} className="focus-ring flex w-full items-center justify-between gap-2 rounded-2xl bg-panel2 px-4 py-3 text-left text-sm"><span>{child.title}<span className="block text-xs text-muted">{child.targetDate ?? "No deadline"} · {child.status.replaceAll("_", " ")}</span></span><span>{planning.insights.find((item) => item.objectiveId === child.id)?.progress ?? 0}%</span></button>)}</div></div> : null}
    <section><h3 className="mb-2 text-sm font-semibold">Tasks / deliverables</h3><div className="space-y-2">{directTasks.map((task) => <label key={task.id} className="flex items-center gap-3 rounded-2xl bg-panel2 p-3"><input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.status === "done"} disabled={busy} onChange={(event) => void onTaskSave({ id: task.id, status: event.target.checked ? "done" : "planned", completionPercent: event.target.checked ? 100 : 0 })} className="h-4 w-4 accent-accent" /><span className="text-sm">{task.title}<span className="block text-xs text-muted">{hours(task.estimatedMinutes)} · {task.completionPercent}%</span></span></label>)}</div>
      <form onSubmit={async (event) => { event.preventDefault(); if (await onTaskSave({ objectiveId: objective.id, title: taskTitle, estimatedMinutes: taskMinutes })) setTaskTitle(""); }} className="mt-3 space-y-2"><TextInput aria-label="New deliverable" placeholder="Next deliverable or task" required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /><div className="flex items-end gap-2"><FieldLabel className="flex-1">Estimate (min)<TextInput aria-label="New task estimate" type="number" min={0} max={1440} required value={taskMinutes} onChange={(event) => setTaskMinutes(Number(event.target.value))} /></FieldLabel><PrimaryButton disabled={busy || !taskTitle.trim()} type="submit">Add task</PrimaryButton></div></form>
    </section>
    <details className="rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">Planning assumptions</summary><p className="mt-3 text-xs leading-5 text-muted">The expected trajectory is linear between start and deadline. Leave manual progress empty to use the average of direct tasks and child objectives. Impact is your assessment, not a measured score.</p><form onSubmit={(event) => void settings(event)} className="mt-3 grid grid-cols-2 gap-3"><FieldLabel>Start date<TextInput aria-label="Objective start date" type="date" required value={startDate} max={objective.targetDate ?? undefined} onChange={(event) => setStartDate(event.target.value)} /></FieldLabel><FieldLabel>Total effort (min)<TextInput aria-label="Objective total effort" type="number" min={0} max={600000} required value={effort} onChange={(event) => setEffort(Number(event.target.value))} /></FieldLabel><FieldLabel>Impact / 100<TextInput aria-label="Objective impact" type="number" min={0} max={100} required value={impact} onChange={(event) => setImpact(Number(event.target.value))} /></FieldLabel><FieldLabel>Manual progress (%)<TextInput aria-label="Manual objective progress" type="number" min={0} max={100} placeholder="Automatic" value={manual} onChange={(event) => setManual(event.target.value)} /></FieldLabel><PrimaryButton disabled={busy} className="col-span-2" type="submit">Save assumptions</PrimaryButton></form></details>
    <details className="rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">Progress history · {insight.history.length} observations</summary><p className="mt-3 text-xs leading-5 text-muted">Task and objective edits record today’s progress automatically. Add past observations only when you know what was completed on that date. A new observation today switches this objective to manual progress.</p><form onSubmit={async (event) => { event.preventDefault(); await onSave({ path: "checkpoint", method: "POST", body: { objectiveId: objective.id, date: checkpointDate, progress: checkpointProgress } }); }} className="mt-3 grid grid-cols-2 gap-3"><FieldLabel>Date<TextInput aria-label="Observation date" type="date" required min={insight.startDate} max={planning.today} value={checkpointDate} onChange={(event) => setCheckpointDate(event.target.value)} /></FieldLabel><FieldLabel>Progress (%)<TextInput aria-label="Observed progress" type="number" required min={0} max={100} value={checkpointProgress} onChange={(event) => setCheckpointProgress(Number(event.target.value))} /></FieldLabel><SecondaryButton type="submit" disabled={busy} className="col-span-2">Save observation</SecondaryButton></form><div className="mt-4 max-h-44 space-y-2 overflow-y-auto">{insight.history.slice().reverse().map((point) => <div key={point.date} className="flex justify-between text-xs"><span className="text-muted">{point.date}</span><span>{point.progress}%</span></div>)}</div></details>
    <details className="rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">Dependencies & three-point estimates</summary><p className="mt-3 text-xs text-muted">Dependencies are between tasks belonging directly to this objective. Estimates are minutes of work, not calendar time.</p>{directTasks.length ? directTasks.map((task) => <TaskDependencyForm key={`${task.id}:${task.likelyMinutes}:${task.predecessorIds.join()}`} task={task} tasks={directTasks} busy={busy} onSave={onSave} />) : <p className="mt-3 text-sm text-muted">Add tasks above to build the critical path.</p>}</details>
    <section><h3 className="mb-2 text-sm font-semibold">Blocks · {planning.month}</h3><div className="space-y-2">{planning.blocks.filter((block) => block.objectiveId === objective.id).map((block) => <button key={block.id} onClick={() => onEditBlock(block)} className="focus-ring block w-full rounded-2xl bg-panel2 p-3 text-left text-sm">{block.title}<span className="mt-1 block text-xs text-muted">{block.date} · {hours(block.durationMinutes)} planned · {block.executionStatus.replaceAll("_", " ")}</span></button>)}</div></section>
  </div>;
}

function TaskDependencyForm({ task, tasks, busy, onSave }: { task: PlanningTask; tasks: PlanningTask[]; busy: boolean; onSave: Props["onSave"] }) {
  const [optimistic, setOptimistic] = useState(task.optimisticMinutes || 30);
  const [likely, setLikely] = useState(task.likelyMinutes || 60);
  const [pessimistic, setPessimistic] = useState(task.pessimisticMinutes || 120);
  const [parents, setParents] = useState(task.predecessorIds);
  return <form onSubmit={async (event) => { event.preventDefault(); await onSave({ path: "task", method: "PATCH", body: { taskId: task.id, optimisticMinutes: optimistic, likelyMinutes: likely, pessimisticMinutes: pessimistic, predecessorIds: parents } }); }} className="mt-4 border-t border-line pt-4"><h4 className="text-sm font-medium">{task.title}</h4><div className="mt-3 grid grid-cols-3 gap-2">{[{ label: "Optimistic", value: optimistic, setter: setOptimistic }, { label: "Likely", value: likely, setter: setLikely }, { label: "Pessimistic", value: pessimistic, setter: setPessimistic }].map((field) => <FieldLabel key={field.label} className="text-xs">{field.label}<TextInput aria-label={`${field.label}: ${task.title}`} type="number" required min={1} max={600000} value={field.value} onChange={(event) => field.setter(Number(event.target.value))} /></FieldLabel>)}</div><p className="my-2 text-xs text-muted">Starts after</p>{tasks.filter((candidate) => candidate.id !== task.id).map((candidate) => <label key={candidate.id} className="my-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={parents.includes(candidate.id)} onChange={(event) => setParents(event.target.checked ? [...parents, candidate.id] : parents.filter((id) => id !== candidate.id))} />{candidate.title}</label>)}<SecondaryButton type="submit" className="mt-2" disabled={busy || optimistic > likely || likely > pessimistic}>Save dependencies</SecondaryButton></form>;
}
