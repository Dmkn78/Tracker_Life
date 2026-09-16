"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";
import { toDateKey } from "@/lib/dates";
import type { TaskWritePayload } from "../api/todoApi";
import type { TodoTask } from "../domain/todoTask";
import { taskSlot } from "../domain/todoPlanning";

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
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const openTasks = tasks.filter((task) => task.status !== "cancelled" && task.status !== "done");

  useEffect(() => {
    if (!rail.current) return;
    const draggable = new Draggable(rail.current, {
      itemSelector: "[data-funnel-task]", longPressDelay: 300,
      eventData: (element) => ({ title: element.dataset.title ?? "", create: false })
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

  async function schedule(taskId: string, date: string, time: string): Promise<void> {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    const slot = taskSlot(date, time);
    const saved = await onMove(taskId, { date, startTime: slot.startTime, endTime: slot.endTime, estimatedMinutes: task.estimatedMinutes || slot.estimatedMinutes });
    if (saved) setSelectedId("");
  }

  return <Card>
    <h2 className="font-semibold">Entonnoir des tâches</h2>
    <p className="mb-3 mt-1 text-xs text-muted">Capture une idée, puis glisse-la dans le planning. Sur téléphone : « Placer », puis touche un créneau.</p>
    <form onSubmit={(event) => void capture(event)} className="mb-4 flex gap-2">
      <TextInput aria-label="Nouvelle tâche dans l’entonnoir" placeholder="Une nouvelle tâche…" maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} />
      <PrimaryButton aria-label="Capturer la tâche" type="submit" disabled={busy || !title.trim()}><Plus className="h-5 w-5" /></PrimaryButton>
    </form>
    {error ? <p role="alert" className="mb-3 text-sm text-risk">{error}</p> : null}
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SecondaryButton aria-label="Période précédente" onClick={() => calendar.current?.getApi().prev()}><ChevronLeft className="h-4 w-4" /></SecondaryButton>
      <SecondaryButton onClick={() => calendar.current?.getApi().today()}>Aujourd’hui</SecondaryButton>
      <SecondaryButton aria-label="Période suivante" onClick={() => calendar.current?.getApi().next()}><ChevronRight className="h-4 w-4" /></SecondaryButton>
      <SecondaryButton onClick={() => calendar.current?.getApi().changeView("timeGridDay")}>Jour</SecondaryButton>
      <SecondaryButton onClick={() => calendar.current?.getApi().changeView("timeGridWeek")}>Semaine</SecondaryButton>
      <span className="text-xs text-muted">{period}</span>
    </div>
    <div className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
      <div ref={rail} className="thin-scrollbar max-h-[660px] space-y-2 overflow-y-auto p-1" aria-label="Tâches à planifier">
        {openTasks.map((task) => <div key={task.id} className={`rounded-xl border p-2 ${selectedId === task.id ? "border-accent bg-accent/10" : "border-line bg-panel2"}`}>
          <div data-funnel-task={task.id} data-title={task.title} className="touch-pan-y cursor-grab text-xs font-medium">
            <GripVertical aria-hidden className="mb-1 h-4 w-4 text-muted" />{task.title}
          </div>
          <p className="my-2 break-words text-[10px] text-muted">{task.objectiveTitle ?? "Sans objectif"}<br />{task.date ? `${task.date} ${task.startTime ?? ""}` : "À planifier"}</p>
          <button className="focus-ring min-h-10 text-xs text-accent" onClick={() => setSelectedId(selectedId === task.id ? "" : task.id)}>{selectedId === task.id ? "Annuler" : "Placer"}</button>
          <button className="focus-ring ml-2 min-h-10 text-xs" onClick={() => onEdit(task)}>Détails</button>
          {task.date ? <button className="focus-ring min-h-10 text-left text-[10px] text-muted" onClick={() => void onMove(task.id, { date: null, startTime: null, endTime: null })}>Retirer du planning</button> : null}
        </div>)}
        {!openTasks.length ? <p className="text-xs text-muted">Aucune tâche en attente.</p> : null}
      </div>
      <div className="calendar-engine min-w-0 overflow-hidden rounded-xl border border-line">
        <FullCalendar ref={calendar} plugins={[timeGridPlugin, interactionPlugin]} initialView="timeGridDay"
          initialDate={toDateKey()} locale="fr" firstDay={1} headerToolbar={false} height={660}
          nowIndicator scrollTime="08:00:00" allDayText="Sans heure" editable droppable eventDurationEditable={false}
          longPressDelay={300} datesSet={(range) => setPeriod(range.view.title)}
          events={tasks.filter((task) => task.date && task.status !== "cancelled").map((task) => ({
            id: task.id, title: task.title, start: `${task.date}${task.startTime ? `T${task.startTime}` : ""}`,
            end: task.endTime ? `${task.date}T${task.endTime}` : undefined, allDay: !task.startTime,
            backgroundColor: "rgb(var(--color-accent) / 0.16)", borderColor: "rgb(var(--color-accent))", textColor: "rgb(var(--color-ink))"
          }))}
          drop={(drop) => void schedule(drop.draggedEl.dataset.funnelTask ?? "", drop.dateStr.slice(0, 10), drop.allDay ? "09:00" : drop.dateStr.slice(11, 16))}
          dateClick={(slot) => { if (selectedId) void schedule(selectedId, slot.dateStr.slice(0, 10), slot.allDay ? "09:00" : slot.dateStr.slice(11, 16)); }}
          eventClick={(event) => { const task = tasks.find((entry) => entry.id === event.event.id); if (task) onEdit(task); }}
          eventDrop={(event) => {
            const start = event.event.startStr; const end = event.event.endStr;
            if (!event.event.allDay && end && start.slice(0, 10) !== end.slice(0, 10)) { event.revert(); return; }
            void onMove(event.event.id, { date: start.slice(0, 10), startTime: event.event.allDay ? null : start.slice(11, 16), endTime: event.event.allDay || !end ? null : end.slice(11, 16) }).then((saved) => { if (!saved) event.revert(); });
          }}
        />
      </div>
    </div>
  </Card>;
}
