"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Card, GhostButton, Metric, Pill, ProgressBar, SecondaryButton } from "@/components/ui";
import { formatDuration } from "@/components/DurationInput";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { ObjectiveOption, TodoTask } from "../domain/todoTask";
import { groupTasksByObjective, monthWeeks, summarizeTasks, taskProgress } from "../domain/todoPlanning";
import type { TaskWritePayload } from "../api/todoApi";

type Props = {
  tasks: TodoTask[];
  objectives: ObjectiveOption[];
  today: string;
  onEdit: (task: TodoTask) => void;
  onCreate: (date?: string, startTime?: string, objectiveId?: string) => void;
};

export function TodoWeeklyCalendar({ tasks, objectives, startDate, objectiveId, onEdit, onCreate, onMove }: Props & { startDate: string; objectiveId: string; onMove: (id: string, patch: TaskWritePayload) => Promise<boolean> }) {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const events = tasks.filter((task) => task.date && task.status !== "cancelled").map((task) => ({
    id: task.id, title: task.title, allDay: !task.startTime,
    start: task.startTime ? `${task.date}T${task.startTime}` : task.date!,
    end: task.startTime ? task.endTime ? `${task.date}T${task.endTime}` : new Date(new Date(`${task.date}T${task.startTime}`).getTime() + Math.max(30, task.estimatedMinutes) * 60000) : undefined,
    backgroundColor: task.status === "done" ? "rgb(var(--color-good) / 0.13)" : "rgb(var(--color-accent) / 0.14)",
    borderColor: objectives.find((objective) => objective.id === task.objectiveId)?.color ?? "rgb(var(--color-accent))",
    textColor: "rgb(var(--color-ink))"
  }));
  const groups = groupTasksByObjective(tasks, objectives, startDate);
  return <div className="grid min-w-0 gap-4 2xl:grid-cols-[220px_minmax(0,1fr)]"><Card className="min-w-0"><h2 className="mb-3 font-semibold">{fr ? "Objectifs de travail" : "Work objectives"}</h2><div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">{groups.filter((group) => group.id || group.tasks.length).map((group) => <div key={group.id} className="rounded-2xl bg-panel2 p-3"><p className="border-l-2 pl-2 text-sm font-medium" style={{ borderColor: group.color ?? "rgb(var(--color-accent))" }}>{group.title || (fr ? "Sans objectif" : "Unassigned")}</p><p className="my-2 text-xs text-muted">{group.horizon} · {group.summary.completed}/{group.summary.total} · {formatDuration(group.summary.plannedMinutes)}</p><ProgressBar value={group.summary.progress} /><GhostButton className="mt-2 text-xs" onClick={() => onCreate(startDate, undefined, group.id)}>+ {fr ? "Planifier" : "Schedule"}</GhostButton></div>)}</div><a href="/objectives" className="focus-ring mt-4 inline-block text-xs text-accent">{fr ? "Gérer les objectifs" : "Manage objectives"}</a></Card><Card className="min-w-0"><h2 className="font-semibold">{fr ? "Planning des tâches" : "Task schedule"}</h2><p className="mb-4 mt-1 text-xs text-muted">{fr ? "Clique sur un créneau pour créer une tâche. Déplace une tâche pour la replanifier ; clique dessus pour la modifier." : "Select a slot to add a task. Drag a task to reschedule; select it to edit."}</p><div className="thin-scrollbar overflow-x-auto rounded-2xl border border-line"><div className="calendar-engine min-w-[720px]"><FullCalendar key={startDate} plugins={[timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" initialDate={startDate} firstDay={1} headerToolbar={false} height={660} nowIndicator editable eventDurationEditable={false} allDayMaintainDuration={false} allDayText={fr ? "Sans heure" : "Unscheduled time"} slotMinTime="00:00:00" slotMaxTime="24:00:00" scrollTime="08:00:00" events={events} locale={locale} slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      dateClick={(selection) => onCreate(selection.dateStr.slice(0, 10), selection.allDay ? undefined : selection.dateStr.slice(11, 16), objectiveId)}
      eventClick={(selection) => { const task = tasks.find((item) => item.id === selection.event.id); if (task) onEdit(task); }}
      eventDrop={(change) => {
        const start = change.event.startStr;
        const end = change.event.endStr;
        // The task model has same-day times; cross-midnight slots need explicit editing.
        if (!change.event.allDay && end && end.slice(0, 10) !== start.slice(0, 10)) { change.revert(); return; }
        void onMove(change.event.id, { date: start.slice(0, 10), startTime: change.event.allDay ? null : start.slice(11, 16), endTime: change.event.allDay || !end ? null : end.slice(11, 16) }).then((saved) => { if (!saved) change.revert(); });
      }} /></div></div></Card></div>;
}

export function TodoMonthlyRoadmap({ tasks, objectives, month, today, onEdit, onCreate }: Props & { month: string }) {
  const { locale } = useLocale(); const fr = locale === "fr";
  const weeks = monthWeeks(month);
  const groups = groupTasksByObjective(tasks, objectives, today).filter((group) => group.tasks.length);
  return <Card><h2 className="font-semibold">{fr ? "Livrables du mois" : "Monthly deliverables"}</h2><p className="mt-1 text-xs text-muted">{fr ? "Objectifs × semaines · chaque tâche reste modifiable." : "Objectives × weeks · select any task to edit it."}</p><div className="thin-scrollbar mt-4 overflow-x-auto"><table className="w-full min-w-[780px] border-separate border-spacing-2 text-left text-sm"><thead><tr><th className="w-52 px-2 font-medium text-muted">{fr ? "Objectif" : "Objective"}</th>{weeks.map((week) => <th key={week.start} className="min-w-36 px-2 text-xs font-medium text-muted">{week.start.slice(5)} — {week.end.slice(5)}</th>)}</tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td className="rounded-2xl bg-panel2 p-3 align-top"><p className="font-medium">{group.title || (fr ? "Sans objectif" : "Unassigned")}</p><p className="my-2 text-xs text-muted">{group.horizon} · {group.summary.completed}/{group.summary.total} · {formatDuration(group.summary.plannedMinutes)}</p><ProgressBar value={group.summary.progress} /></td>{weeks.map((week) => <td key={week.start} className="rounded-2xl bg-panel2/60 p-2 align-top"><div className="space-y-2">{group.tasks.filter((task) => task.date && task.date >= week.start && task.date <= week.end).map((task) => <button key={task.id} onClick={() => onEdit(task)} className="focus-ring block w-full rounded-xl border-l-2 bg-panel p-3 text-left text-xs" style={{ borderColor: group.color ?? "rgb(var(--color-accent))" }}><span className="block font-medium">{task.title}</span><span className="my-2 block text-muted">{task.date?.slice(5)} · {formatDuration(task.estimatedMinutes)} · {taskProgress(task)}%</span><ProgressBar value={taskProgress(task)} /></button>)}<GhostButton className="text-xs" onClick={() => onCreate(week.start < `${month}-01` ? `${month}-01` : week.start, undefined, group.id)}>+ {fr ? "Tâche" : "Task"}</GhostButton></div></td>)}</tr>)}</tbody></table></div>{!groups.length ? <div className="py-8 text-center"><p className="mb-3 text-sm text-muted">{fr ? "Aucune tâche planifiée pour ce mois." : "No tasks planned for this month."}</p><SecondaryButton onClick={() => onCreate(`${month}-01`)}>{fr ? "Planifier une tâche" : "Plan a task"}</SecondaryButton></div> : null}</Card>;
}

export function TodoExecutionInsights({ tasks, objectives, today, onEdit, onCreate }: Props) {
  const { locale } = useLocale(); const fr = locale === "fr";
  const summary = summarizeTasks(tasks, today);
  const groups = groupTasksByObjective(tasks, objectives, today).filter((group) => group.tasks.length);
  const reviewTasks = tasks.filter((task) => taskProgress(task) < 100 && task.status !== "cancelled" && ((task.date && task.date < today) || task.importance === "high" || !task.date)).sort((a, b) => Number(b.importance === "high") - Number(a.importance === "high")).slice(0, 4);
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label={fr ? "Travail restant estimé" : "Estimated remaining work"} value={formatDuration(summary.remainingMinutes)} detail={`${summary.missingEstimates} ${fr ? "tâches sans estimation" : "tasks without estimates"}`} /><Metric label={fr ? "Temps réellement enregistré" : "Recorded work"} value={formatDuration(summary.actualMinutes)} detail={fr ? "Sessions liées aux tâches affichées" : "Sessions linked to displayed tasks"} /><Metric label={fr ? "À replanifier / revoir" : "Scheduled earlier"} value={String(summary.scheduledEarlier)} detail={fr ? "Une date de tâche n’est pas une deadline" : "A task date is not a deadline"} /></div><Card><h2 className="mb-4 font-semibold">{fr ? "Prochaines décisions" : "Next decisions"}</h2><div className="grid gap-3 sm:grid-cols-2">{reviewTasks.map((task) => <div key={task.id} className="rounded-2xl bg-panel2 p-4"><button onClick={() => onEdit(task)} className="focus-ring text-left text-sm font-medium">{task.title}</button><p className="my-2 text-xs text-muted">{task.date && task.date < today ? (fr ? "Date planifiée passée : replanifier, réduire le travail ou annuler si devenu inutile." : "Scheduled date passed: reschedule, reduce the work or cancel if no longer useful.") : (fr ? "Définir le prochain créneau de travail." : "Choose the next work slot.")}</p><SecondaryButton onClick={() => onEdit(task)}>{fr ? "Revoir la tâche" : "Review task"}</SecondaryButton></div>)}</div>{!reviewTasks.length ? <p className="text-sm text-muted">{fr ? "Aucun ajustement suggéré pour les tâches affichées." : "No adjustment suggested for the displayed tasks."}</p> : null}</Card><Card><h2 className="mb-4 font-semibold">{fr ? "Progression et allocation par objectif" : "Progress and allocation by objective"}</h2><div className="space-y-4">{groups.map((group) => <div key={group.id} className="rounded-2xl bg-panel2 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{group.title || (fr ? "Sans objectif" : "Unassigned")}</span><Pill>{group.summary.completed}/{group.summary.total} · {group.summary.progress}%</Pill></div><div className="my-3"><ProgressBar value={group.summary.progress} /></div><p className="text-xs text-muted">{formatDuration(group.summary.plannedMinutes)} {fr ? "estimé" : "estimated"} · {formatDuration(group.summary.actualMinutes)} {fr ? "enregistré" : "recorded"} · {formatDuration(group.summary.remainingMinutes)} {fr ? "restant estimé" : "estimated remaining"}</p><GhostButton className="mt-2" onClick={() => onCreate(today, undefined, group.id)}>+ {fr ? "Planifier la suite" : "Plan next action"}</GhostButton></div>)}</div></Card></div>;
}
