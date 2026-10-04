"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";
import { Card, FieldLabel, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";
import { DurationInput, formatDuration } from "@/components/DurationInput";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { getIsoWeekId, getWeekDateKeys, parseDateKey, toDateKey } from "@/lib/dates";
import type { TaskWritePayload } from "../api/todoApi";
import type { ObjectiveOption, TodoTask } from "../domain/todoTask";
import { planFunnelTask, taskPlanDuration } from "../domain/funnelPlanning";
import { buildWeeklyObjectiveRows, scheduledWorkMinutes } from "../domain/weeklyObjectives";
import { WeeklyObjectivesTable } from "./WeeklyObjectivesTable";

const CALENDAR_PLUGINS = [timeGridPlugin, interactionPlugin];
const DEFAULT_ACTION_MINUTES = 60;

type Props = {
  tasks: TodoTask[];
  objectives: ObjectiveOption[];
  today?: string;
  onCreateObjective: (input: { title: string; weekId: string }) => Promise<ObjectiveOption>;
  onCapture: (input: { title: string; objectiveId: string | null; estimatedMinutes: number }) => Promise<void>;
  onMove: (id: string, patch: TaskWritePayload) => Promise<boolean>;
  onEdit: (task: TodoTask) => void;
};

export function TaskFunnel({ tasks, objectives, today = toDateKey(), onCreateObjective, onCapture, onMove, onEdit }: Props) {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const rail = useRef<HTMLDivElement>(null);
  const calendar = useRef<FullCalendar>(null);
  const [title, setTitle] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(DEFAULT_ACTION_MINUTES);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [placementDate, setPlacementDate] = useState(today);
  const [placementTime, setPlacementTime] = useState("09:00");
  const [period, setPeriod] = useState("");
  const [weekId, setWeekId] = useState(() => getIsoWeekId(today));
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const moveInProgress = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const weekDates = getWeekDateKeys(weekId);
  const openTasks = tasks.filter((task) => task.status !== "cancelled" && task.status !== "done" && (!selectedObjectiveId || task.objectiveId === selectedObjectiveId));
  const pendingTasks = openTasks.filter((task) => !task.date);
  const plannedTasks = openTasks.filter((task) => task.date);
  const selectedTask = openTasks.find((task) => task.id === selectedId);
  const selectedObjective = objectives.find((objective) => objective.id === selectedObjectiveId);
  const objectiveRows = buildWeeklyObjectiveRows({ objectives, tasks, weekId, firstDate: weekDates[0], lastDate: weekDates[6], selectedObjectiveId });
  const events = useMemo(() => tasks.filter((task) => task.date && task.status !== "cancelled").map((task) => ({
    id: task.id,
    title: task.title,
    start: `${task.date}${task.startTime ? `T${task.startTime}` : ""}`,
    end: task.startTime && task.endTime ? `${task.date}T${task.endTime}` : undefined,
    allDay: !task.startTime,
    backgroundColor: task.status === "done" ? "rgb(var(--color-good) / 0.16)" : "rgb(var(--color-accent) / 0.16)",
    borderColor: "rgb(var(--color-accent))",
    textColor: "rgb(var(--color-ink))"
  })), [tasks]);

  useEffect(() => {
    if (!rail.current) return;
    const draggable = new Draggable(rail.current, {
      itemSelector: "[data-funnel-task]", longPressDelay: 0, minDistance: 8,
      eventData: (element) => ({ title: element.dataset.title ?? "", duration: { minutes: Number(element.dataset.duration) }, create: false })
    });
    return () => draggable.destroy();
  }, []);

  async function capture(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!title.trim() || busy || estimatedMinutes <= 0) return;
    setBusy(true);
    setError("");
    try {
      await onCapture({ title: title.trim(), objectiveId: selectedObjectiveId || null, estimatedMinutes });
      setTitle("");
      setMessage(fr ? "Action ajoutée. Glisse-la dans la semaine ou utilise « Placer »." : "Action added. Drag it into the week or select “Schedule”.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fr ? "Impossible de créer l’action." : "Could not create the action.");
    } finally {
      setBusy(false);
    }
  }

  function selectObjective(objectiveId: string): void {
    setSelectedObjectiveId(objectiveId);
    setSelectedId("");
    setError("");
    setMessage("");
  }

  function selectTask(task: TodoTask): void {
    setError("");
    setMessage("");
    if (selectedId === task.id) { setSelectedId(""); return; }
    setSelectedId(task.id);
    setPlacementDate(task.date ?? (weekDates.includes(today) ? today : weekDates[0]));
    setPlacementTime(task.startTime ?? "09:00");
  }

  async function moveTask(taskId: string, patch: TaskWritePayload): Promise<boolean> {
    if (moveInProgress.current) return false;
    moveInProgress.current = true;
    setMoving(true);
    setError("");
    setMessage("");
    try {
      if (!await onMove(taskId, patch)) throw new Error(fr ? "Placement non enregistré. Vérifie la connexion et réessaie." : "Schedule was not saved. Check the connection and try again.");
      setMessage(patch.date ? (fr ? `Action planifiée le ${patch.date}${patch.startTime ? ` à ${patch.startTime}` : ", sans heure"}.` : `Action scheduled on ${patch.date}${patch.startTime ? ` at ${patch.startTime}` : ", without a time"}.`) : (fr ? "Action remise dans les actions à placer." : "Action returned to the unscheduled actions."));
      setSelectedId("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fr ? "Impossible de modifier le planning." : "Could not change the schedule.");
      return false;
    } finally {
      moveInProgress.current = false;
      setMoving(false);
    }
  }

  async function schedule(taskId: string, date: string, time: string | null): Promise<void> {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    try { await moveTask(taskId, planFunnelTask(task, date, time)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : fr ? "Créneau invalide." : "Invalid time slot."); }
  }

  function renderTask(task: TodoTask) {
    return <div key={task.id} className={`min-w-0 rounded-xl border p-3 ${selectedId === task.id ? "border-accent bg-accent/10" : "border-line bg-panel2"}`}>
      <div data-funnel-task={moving ? undefined : task.id} data-title={task.title} data-duration={taskPlanDuration(task)} title={fr ? "Glisser vers un créneau du calendrier" : "Drag onto a calendar time slot"} className="touch-none cursor-grab select-none rounded-lg py-1 text-sm font-medium active:cursor-grabbing">
        <div className="flex items-start gap-1"><GripVertical aria-hidden className="h-4 w-4 shrink-0 text-muted" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{task.title}</span></div>
        <p className="mt-2 break-words text-xs font-normal text-muted">{task.objectiveTitle ?? (fr ? "Sans objectif" : "No objective")} · {formatDuration(taskPlanDuration(task))}</p>
        {task.date ? <p className="mt-1 text-xs font-normal text-muted">{task.date} {task.startTime ?? (fr ? "sans heure" : "without a time")}</p> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <SecondaryButton disabled={moving} aria-pressed={selectedId === task.id} onClick={() => selectTask(task)}>{selectedId === task.id ? (fr ? "Annuler" : "Cancel") : (fr ? "Placer" : "Schedule")}</SecondaryButton>
        <SecondaryButton onClick={() => onEdit(task)}>{fr ? "Détails" : "Details"}</SecondaryButton>
        {task.date ? <button type="button" disabled={moving} className="focus-ring min-h-10 w-full rounded-lg text-left text-xs text-muted disabled:opacity-50" onClick={() => void moveTask(task.id, { date: null, startTime: null, endTime: null })}>{fr ? "Retirer du planning" : "Remove from schedule"}</button> : null}
      </div>
    </div>;
  }

  return <Card>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">{fr ? "Préparer ma semaine" : "Prepare my week"}</h2><p className="mt-1 text-xs text-muted">{fr ? "Objectifs → actions et durée → jours et heures de travail." : "Objectives → actions and duration → days and working hours."}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton aria-label={fr ? "Semaine précédente" : "Previous week"} onClick={() => calendar.current?.getApi().prev()}><ChevronLeft className="h-4 w-4" /></SecondaryButton>
        <SecondaryButton onClick={() => calendar.current?.getApi().gotoDate(today)}>{fr ? "Cette semaine" : "This week"}</SecondaryButton>
        <SecondaryButton aria-label={fr ? "Semaine suivante" : "Next week"} onClick={() => calendar.current?.getApi().next()}><ChevronRight className="h-4 w-4" /></SecondaryButton>
        <span className="text-xs text-muted">{period || weekId}</span>
      </div>
    </div>
    <WeeklyObjectivesTable weekId={weekId} rows={objectiveRows} objectives={objectives} selectedObjectiveId={selectedObjectiveId} onSelect={selectObjective} onCreate={onCreateObjective} />
    {error ? <p role="alert" className="mb-3 text-sm text-risk">{error}</p> : null}
    {message ? <p role="status" className="mb-3 text-sm text-muted">{message}</p> : null}
    <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section className="min-w-0">
        <h3 className="mb-1 font-semibold">2. {fr ? "Actions et durée" : "Actions and duration"}</h3>
        <p className="mb-3 break-words text-xs text-muted">{selectedObjective?.title ?? (fr ? "Toutes les actions" : "All actions")}</p>
        <form onSubmit={(event) => void capture(event)} className="mb-4 space-y-3 rounded-xl border border-line p-3">
          <FieldLabel className="block">{fr ? "Nouvelle action" : "New action"}<TextInput className="mt-1" placeholder={fr ? "Ex. Faire les exercices 1 à 5" : "E.g. Complete exercises 1–5"} maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy} /></FieldLabel>
          <DurationInput label={fr ? "Temps de travail prévu" : "Planned working time"} value={estimatedMinutes} onChange={setEstimatedMinutes} showStored={false} disabled={busy} />
          <PrimaryButton className="w-full" type="submit" disabled={busy || !title.trim() || estimatedMinutes <= 0}><Plus className="h-4 w-4" />{busy ? (fr ? "Ajout…" : "Adding…") : (fr ? "Ajouter l’action" : "Add action")}</PrimaryButton>
        </form>
        {selectedTask ? <form aria-label={fr ? "Placer l’action" : "Schedule action"} className="mb-4 space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-3" onSubmit={(event) => { event.preventDefault(); void schedule(selectedTask.id, placementDate, placementTime || null); }}>
          <p className="break-words text-sm font-medium">{selectedTask.title} · {formatDuration(taskPlanDuration(selectedTask))}</p>
          <p className="text-xs text-muted">{fr ? "Touche un créneau ou choisis le jour et l’heure." : "Tap a time slot or choose the day and time."}</p>
          <FieldLabel className="block">{fr ? "Jour" : "Day"}<TextInput className="mt-1" type="date" required value={placementDate} onChange={(event) => setPlacementDate(event.target.value)} /></FieldLabel>
          <FieldLabel className="block">{fr ? "Heure (facultative)" : "Time (optional)"}<TextInput className="mt-1" type="time" max="23:58" value={placementTime} onChange={(event) => setPlacementTime(event.target.value)} /></FieldLabel>
          <PrimaryButton className="w-full" type="submit" disabled={moving}>{moving ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Confirmer le placement" : "Confirm schedule")}</PrimaryButton>
        </form> : null}
        <div ref={rail} className="thin-scrollbar max-h-[660px] space-y-3 overflow-y-auto p-1" aria-label={fr ? "Actions à planifier" : "Actions to schedule"}>
          <p className="text-xs font-semibold text-muted">{fr ? "À placer" : "Unscheduled"} ({pendingTasks.length})</p>
          {pendingTasks.map(renderTask)}
          {!pendingTasks.length ? <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">{fr ? "Ajoute une action ci-dessus, puis glisse-la dans la semaine." : "Add an action above, then drag it into the week."}</p> : null}
          {plannedTasks.length ? <details><summary className="focus-ring cursor-pointer rounded-lg py-3 text-xs text-muted">{fr ? "Déjà planifiées" : "Already scheduled"} ({plannedTasks.length})</summary><div className="space-y-3">{plannedTasks.map(renderTask)}</div></details> : null}
        </div>
      </section>
      <section className="min-w-0">
        <h3 className="mb-1 font-semibold">3. {fr ? "Jours et heures de travail" : "Days and working hours"}</h3>
        <p className="mb-3 text-xs text-muted">{fr ? "Glisse une action à l’heure souhaitée. Sur mobile, utilise « Placer » et fais défiler la semaine horizontalement." : "Drag an action onto its time slot. On mobile, use “Schedule” and scroll the week horizontally."}</p>
        <div className="mb-3 grid grid-cols-7 gap-1" aria-label={fr ? "Temps planifié par jour" : "Scheduled time per day"}>{weekDates.map((day) => {
          const minutes = tasks.filter((task) => task.date === day && task.status !== "cancelled").reduce((total, task) => total + scheduledWorkMinutes(task), 0);
          return <div key={day} className="rounded-lg bg-panel2 px-1 py-2 text-center text-[10px] sm:text-xs"><p className="text-muted">{new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(parseDateKey(day))}</p><p className="mt-1 font-medium">{formatDuration(minutes)}</p></div>;
        })}</div>
        <div className={`calendar-engine thin-scrollbar min-w-0 overflow-x-auto rounded-xl border ${selectedTask ? "border-accent [&_.fc-timegrid-col]:cursor-crosshair" : "border-line"}`} aria-busy={moving}>
          <div className="min-w-[680px]">
            <FullCalendar ref={calendar} plugins={CALENDAR_PLUGINS} initialView="timeGridWeek"
              initialDate={today} locale={locale} firstDay={1} headerToolbar={false} height={660}
              nowIndicator scrollTime="08:00:00" allDayText={fr ? "Sans heure" : "No time"} editable={!moving} droppable={!moving} eventDurationEditable={false}
              longPressDelay={300} datesSet={(range) => {
                const visibleWeekId = getIsoWeekId(toDateKey(range.start));
                setPeriod(range.view.title);
                setWeekId(visibleWeekId);
                if (visibleWeekId !== weekId) selectObjective("");
              }}
              events={events}
              drop={(drop) => void schedule(drop.draggedEl.dataset.funnelTask ?? "", drop.dateStr.slice(0, 10), drop.allDay ? null : drop.dateStr.slice(11, 16))}
              dateClick={(slot) => {
                if (selectedTask) void schedule(selectedTask.id, slot.dateStr.slice(0, 10), slot.allDay ? null : slot.dateStr.slice(11, 16));
                else setMessage(fr ? "Choisis « Placer » sur une action, puis touche le créneau souhaité." : "Select “Schedule” on an action, then tap its time slot.");
              }}
              eventClick={(event) => { const task = tasks.find((entry) => entry.id === event.event.id); if (task) onEdit(task); }}
              eventDrop={(event) => {
                const start = event.event.startStr;
                const end = event.event.endStr;
                if (!event.event.allDay && end && start.slice(0, 10) !== end.slice(0, 10)) { event.revert(); return; }
                void moveTask(event.event.id, { date: start.slice(0, 10), startTime: event.event.allDay ? null : start.slice(11, 16), endTime: event.event.allDay || !end ? null : end.slice(11, 16) }).then((saved) => { if (!saved) event.revert(); });
              }}
            />
          </div>
        </div>
      </section>
    </div>
  </Card>;
}
