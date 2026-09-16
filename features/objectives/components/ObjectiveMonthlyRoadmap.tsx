"use client";

import { Card, GhostButton, Pill, ProgressBar, SecondaryButton } from "@/components/ui";
import type { ObjectiveSummary } from "../domain/objective";
import type { PlanningData } from "../domain/planning";
import { hours } from "../domain/planning";

type Props = {
  objectives: ObjectiveSummary[];
  planning: PlanningData;
  selectedId: string;
  onSelect: (id: string) => void;
  onMilestone: (parentId: string, date: string) => void;
};

export function ObjectiveMonthlyRoadmap({ objectives, planning, selectedId, onSelect, onMilestone }: Props) {
  const visible = objectives.filter((objective) => objective.kind !== "milestone" || !objective.parentId || objectives.some((child) => child.parentId === objective.id));
  return <Card>
    <div className="mb-5"><h2 className="font-semibold">Monthly roadmap</h2><p className="mt-1 text-sm text-muted">Objectives → milestones → weekly actions. Select an objective to inspect its execution.</p></div>
    {!visible.length ? <p className="text-sm text-muted">Add an objective to start your roadmap.</p> : <div className="thin-scrollbar overflow-x-auto">
      <table className="w-full min-w-[820px] border-separate border-spacing-2 text-left text-sm">
        <thead><tr><th className="w-60 px-3 text-xs font-medium text-muted">Objective</th>{planning.weeks.map((week) => <th key={week.start} className="min-w-40 px-3 text-xs font-medium text-muted">{week.label}<span className="mt-1 block font-normal">{week.start.slice(5)} — {week.end.slice(5)}</span></th>)}</tr></thead>
        <tbody>{visible.map((objective) => {
          const insight = planning.insights.find((item) => item.objectiveId === objective.id);
          return <tr key={objective.id}>
            <td className={`rounded-2xl p-3 align-top ${selectedId === objective.id ? "bg-accent/10 ring-1 ring-accent/30" : "bg-panel2"}`}>
              <button className="focus-ring text-left font-medium text-ink" onClick={() => onSelect(objective.id)}><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: objective.color }} />{objective.title}</button>
              <div className="my-2 flex flex-wrap gap-1"><Pill>{objective.horizon}</Pill><Pill>{objective.priority}</Pill></div>
              <ProgressBar value={insight?.progress ?? 0} /><p className="mt-2 text-xs text-muted">{insight?.progress ?? 0}% · {hours(insight?.plannedMonthMinutes ?? 0)} planned</p>
              {objective.targetDate ? <p className="mt-1 text-xs text-muted">Due {objective.targetDate}</p> : null}
            </td>
            {planning.weeks.map((week) => {
              const children = objectives.filter((child) => child.parentId === objective.id && child.targetDate && child.targetDate >= week.start && child.targetDate <= week.end);
              const blocks = planning.blocks.filter((block) => block.objectiveId === objective.id && block.date >= week.start && block.date <= week.end);
              const tasks = planning.tasks.filter((task) => task.objectiveId === objective.id && task.date && task.date >= week.start && task.date <= week.end);
              return <td key={week.start} className="rounded-2xl bg-panel2/60 p-2 align-top">
                <div className="space-y-2">{children.map((child) => <button key={child.id} onClick={() => onSelect(child.id)} className="focus-ring block w-full rounded-xl border-l-2 border-accent bg-panel p-2 text-left text-xs"><span className="block font-medium">{child.title}</span><span className="mt-1 block text-muted">{child.kind} · {child.status.replaceAll("_", " ")}</span></button>)}
                  {tasks.map((task) => <p key={task.id} className="rounded-xl bg-panel/70 p-2 text-xs text-muted">{task.status === "done" ? "✓ " : "· "}{task.title}</p>)}
                  {blocks.length ? <p className="px-1 text-xs text-muted">{blocks.length} blocks · {hours(blocks.reduce((sum, block) => sum + block.durationMinutes, 0))}</p> : null}
                  <GhostButton className="text-xs" onClick={() => onMilestone(objective.id, week.end)}>+ Milestone</GhostButton>
                </div>
              </td>;
            })}
          </tr>;
        })}</tbody>
      </table>
    </div>}
    {objectives.some((objective) => objective.kind === "milestone" && !objective.targetDate) ? <div className="mt-4 border-t border-line pt-4"><p className="mb-2 text-xs text-muted">Unscheduled milestones</p><div className="flex flex-wrap gap-2">{objectives.filter((objective) => objective.kind === "milestone" && !objective.targetDate).map((objective) => <SecondaryButton key={objective.id} onClick={() => onSelect(objective.id)}>{objective.title}</SecondaryButton>)}</div></div> : null}
  </Card>;
}
