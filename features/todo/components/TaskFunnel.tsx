"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";
import { Card, FieldLabel, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";
import { toDateKey } from "@/lib/dates";
import type { TaskWritePayload } from "../api/todoApi";
import type { TodoTask } from "../domain/todoTask";
import { planFunnelTask, taskPlanDuration } from "../domain/funnelPlanning";

const CALENDAR_PLUGINS = [timeGridPlugin, interactionPlugin];

type Props = {
  tasks: TodoTask[];
  onCapture: (title: string) => Promise<void>;
  onMove: (id: string, patch: TaskWritePayload) => Promise<boolean>;
  onEdit: (task: TodoTask) => void;
};

export function TaskFunnel({ tasks, onCapture, onMove, onEdit }: Props) {
  const rail = useRef<HTMLDivElement>(null);
  const calendar = useRef<FullCalendar>(null);
  const [title, setTitle] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [placementDate, setPlacementDate] = useState(toDateKey());
  const [placementTime, setPlacementTime] = useState("09:00");
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const moveInProgress = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const openTasks = tasks.filter((task) => task.status !== "cancelled" && task.status !== "done");
  const selectedTask = openTasks.find((task) => task.id === selectedId);
  const events = useMemo(() => tasks.filter((task) => task.date && task.status !== "cancelled").map((task) => ({
    id: task.id, title: task.title, start: `${task.date}${task.startTime ? `T${task.startTime}` : ""}`,
    end: task.startTime && task.endTime ? `${task.date}T${task.endTime}` : undefined, allDay: !task.startTime,
    backgroundColor: "rgb(var(--color-accent) / 0.16)", borderColor: "rgb(var(--color-accent))", textColor: "rgb(var(--color-ink))"
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
    if (!title.trim() || busy) return;
    setBusy(true); setError("");
    try { await onCapture(title.trim()); setTitle(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de créer la tâche."); }
    finally { setBusy(false); }
  }

  function selectTask(task: TodoTask): void {
    setError(""); setMessage("");
    if (selectedId === task.id) { setSelectedId(""); return; }
    setSelectedId(task.id);
    setPlacementDate(toDateKey(calendar.current?.getApi().getDate() ?? new Date()));
    setPlacementTime(task.startTime ?? "09:00");
  }

  async function moveTask(taskId: string, patch: TaskWritePayload): Promise<boolean> {
    if (moveInProgress.current) return false;
    moveInProgress.current = true;
    setMoving(true); setError(""); setMessage("");
    try {
      if (!await onMove(taskId, patch)) throw new Error("Placement non enregistré. Vérifie la connexion au serveur et réessaie.");
      setMessage(patch.date ? `Tâche planifiée le ${patch.date}${patch.startTime ? ` à ${patch.startTime}` : ", sans heure"}.` : "Tâche retirée du planning.");
      setSelectedId("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de modifier le planning.");
      return false;
    } finally { moveInProgress.current = false; setMoving(false); }
  }

  async function schedule(taskId: string, date: string, time: string | null): Promise<void> {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    try { await moveTask(taskId, planFunnelTask(task, date, time)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Créneau invalide."); }
  }

  return <Card>
    <h2 className="font-semibold">Entonnoir des tâches</h2>
    <p className="mb-3 mt-1 text-xs text-muted">Glisse une carte vers un créneau, ou utilise « Placer » pour choisir sa date et son heure.</p>
    <form onSubmit={(event) => void capture(event)} className="mb-4 flex gap-2">
      <TextInput aria-label="Nouvelle tâche dans l’entonnoir" placeholder="Une nouvelle tâche…" maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} />
      <PrimaryButton aria-label="Capturer la tâche" type="submit" disabled={busy || !title.trim()}><Plus className="h-5 w-5" /></PrimaryButton>
    </form>
    {error ? <p role="alert" className="mb-3 text-sm text-risk">{error}</p> : null}
    {message ? <p role="status" className="mb-3 text-sm text-muted">{message}</p> : null}
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SecondaryButton aria-label="Période précédente" onClick={() => calendar.current?.getApi().prev()}><ChevronLeft className="h-4 w-4" /></SecondaryButton>
      <SecondaryButton onClick={() => calendar.current?.getApi().today()}>Aujourd’hui</SecondaryButton>
      <SecondaryButton aria-label="Période suivante" onClick={() => calendar.current?.getApi().next()}><ChevronRight className="h-4 w-4" /></SecondaryButton>
      <SecondaryButton onClick={() => calendar.current?.getApi().changeView("timeGridDay")}>Jour</SecondaryButton>
      <SecondaryButton onClick={() => calendar.current?.getApi().changeView("timeGridWeek")}>Semaine</SecondaryButton>
      <span className="text-xs text-muted">{period}</span>
    </div>
    {selectedTask ? <form aria-label="Placer la tâche" className="mb-4 space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-3" onSubmit={(event) => { event.preventDefault(); void schedule(selectedTask.id, placementDate, placementTime || null); }}>
      <p className="break-words text-sm font-medium">Placer : {selectedTask.title}</p>
      <p className="text-xs text-muted">Touche un créneau du calendrier, ou valide les champs ci-dessous.</p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <FieldLabel>Date<TextInput type="date" required value={placementDate} onChange={(event) => setPlacementDate(event.target.value)} /></FieldLabel>
        <FieldLabel>Heure (facultative)<TextInput type="time" max="23:58" value={placementTime} onChange={(event) => setPlacementTime(event.target.value)} /></FieldLabel>
        <PrimaryButton type="submit" disabled={moving}>{moving ? "Enregistrement…" : "Confirmer le placement"}</PrimaryButton>
      </div>
    </form> : null}
    <div className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
      <div ref={rail} className="thin-scrollbar max-h-[660px] space-y-2 overflow-y-auto p-1" aria-label="Tâches à planifier">
        {openTasks.map((task) => <div key={task.id} className={`min-w-0 rounded-xl border p-2 ${selectedId === task.id ? "border-accent bg-accent/10" : "border-line bg-panel2"}`}>
          <div data-funnel-task={moving ? undefined : task.id} data-title={task.title} data-duration={taskPlanDuration(task)} title="Glisser vers un créneau du calendrier" className="min-h-16 touch-none select-none rounded-lg py-2 text-xs font-medium cursor-grab active:cursor-grabbing">
            <div className="flex items-start gap-1"><GripVertical aria-hidden className="h-4 w-4 shrink-0 text-muted" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{task.title}</span></div>
            <p className="my-2 break-words text-[10px] font-normal text-muted">{task.objectiveTitle ?? "Sans objectif"}<br />{task.date ? `${task.date} ${task.startTime ?? ""}` : "À planifier"}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" disabled={moving} aria-pressed={selectedId === task.id} className="focus-ring min-h-11 min-w-0 rounded-lg border border-line px-2 text-xs text-accent disabled:opacity-50" onClick={() => selectTask(task)}>{selectedId === task.id ? "Annuler" : "Placer"}</button>
            <button type="button" className="focus-ring min-h-11 min-w-0 rounded-lg border border-line px-2 text-xs" onClick={() => onEdit(task)}>Détails</button>
            {task.date ? <button type="button" disabled={moving} className="focus-ring col-span-full min-h-11 w-full rounded-lg px-2 text-left text-[10px] text-muted disabled:opacity-50" onClick={() => void moveTask(task.id, { date: null, startTime: null, endTime: null })}>Retirer du planning</button> : null}
          </div>
        </div>)}
        {!openTasks.length ? <p className="text-xs text-muted">Aucune tâche en attente.</p> : null}
      </div>
      <div className={`calendar-engine min-w-0 overflow-hidden rounded-xl border ${selectedTask ? "border-accent [&_.fc-timegrid-col]:cursor-crosshair" : "border-line"}`} aria-busy={moving}>
        <FullCalendar ref={calendar} plugins={CALENDAR_PLUGINS} initialView="timeGridDay"
          initialDate={toDateKey()} locale="fr" firstDay={1} headerToolbar={false} height={660}
          nowIndicator scrollTime="08:00:00" allDayText="Sans heure" editable={!moving} droppable={!moving} eventDurationEditable={false}
          longPressDelay={300} datesSet={(range) => setPeriod(range.view.title)}
          events={events}
          drop={(drop) => void schedule(drop.draggedEl.dataset.funnelTask ?? "", drop.dateStr.slice(0, 10), drop.allDay ? null : drop.dateStr.slice(11, 16))}
          dateClick={(slot) => {
            if (selectedTask) void schedule(selectedTask.id, slot.dateStr.slice(0, 10), slot.allDay ? null : slot.dateStr.slice(11, 16));
            else setMessage("Choisis « Placer » sur une tâche, puis touche le créneau souhaité.");
          }}
          eventClick={(event) => { const task = tasks.find((entry) => entry.id === event.event.id); if (task) onEdit(task); }}
          eventDrop={(event) => {
            const start = event.event.startStr; const end = event.event.endStr;
            if (!event.event.allDay && end && start.slice(0, 10) !== end.slice(0, 10)) { event.revert(); return; }
            void moveTask(event.event.id, { date: start.slice(0, 10), startTime: event.event.allDay ? null : start.slice(11, 16), endTime: event.event.allDay || !end ? null : end.slice(11, 16) }).then((saved) => { if (!saved) event.revert(); });
          }}
        />
      </div>
    </div>
  </Card>;
}
