"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { CalendarPlus, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton, PrimaryButton, SelectInput, TextInput } from "@/components/ui";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent
} from "@/features/calendar/api/calendarEventsApi";
import type { LifeTerminalEvent } from "@/features/life-terminal/domain/lifeTerminal";
import { ApiError } from "@/lib/http/apiClient";
import { TerminalPanel } from "./TerminalPanel";

type EventFormState = {
  id?: string;
  title: string;
  type: string;
  impact: string;
  start: string;
  end: string;
  expectedStress: number;
  expectedPreparationLoad: number;
};

const EVENT_TYPES = ["exam", "interview", "deadline", "admin", "social", "training", "recovery", "travel", "personal"];
const EVENT_IMPACTS = ["low", "medium", "high", "critical"];

export function CalendarCommandCenter({
  initialEvents
}: {
  initialEvents: LifeTerminalEvent[];
}) {
  const [events, setEvents] = useState<LifeTerminalEvent[]>(initialEvents);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; values: EventFormState } | null>(null);
  const [error, setError] = useState("");

  const calendarEvents = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        extendedProps: event
      })),
    [events]
  );

  function openCreate(startDate: Date, endDate = addHours(startDate, 1)) {
    setError("");
    setModal({
      mode: "create",
      values: {
        title: "",
        type: "personal",
        impact: "medium",
        start: toInputDateTime(startDate),
        end: toInputDateTime(endDate),
        expectedStress: 50,
        expectedPreparationLoad: 50
      }
    });
  }

  function openEdit(event: LifeTerminalEvent) {
    setError("");
    setModal({
      mode: "edit",
      values: {
        id: event.id,
        title: event.title,
        type: event.type,
        impact: event.impact,
        start: toInputDateTime(event.start),
        end: toInputDateTime(event.end),
        expectedStress: event.expectedStress,
        expectedPreparationLoad: event.expectedPreparationLoad
      }
    });
  }

  async function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!modal) return;
    setError("");
    try {
      const { id, ...eventValues } = modal.values;
      const input = {
        ...eventValues,
        start: new Date(modal.values.start).toISOString(),
        end: new Date(modal.values.end).toISOString()
      };
      if (modal.mode === "edit" && !id) {
        setError("Calendar event id is missing.");
        return;
      }
      const savedEvent = modal.mode === "create"
        ? await createCalendarEvent(input)
        : await updateCalendarEvent({ ...input, id: id ?? "" });
      setEvents((current) => {
        const next = modal.mode === "create"
          ? [...current, savedEvent]
          : current.map((item) => (item.id === savedEvent.id ? savedEvent : item));
        return next.sort((a, b) => a.start.localeCompare(b.start));
      });
      setModal(null);
    } catch (saveError) {
      setError(readApiErrorMessage(saveError, "Calendar save failed."));
    }
  }

  async function patchEventTime(id: string, start: Date | null, end: Date | null) {
    if (!start) return;
    try {
      const updatedEvent = await updateCalendarEvent({
        id,
        start: start.toISOString(),
        end: (end ?? addHours(start, 1)).toISOString()
      });
      setEvents((current) =>
        current.map((item) => (item.id === updatedEvent.id ? updatedEvent : item))
      );
    } catch (moveError) {
      setError(readApiErrorMessage(moveError, "Calendar move failed."));
    }
  }

  async function deleteEvent() {
    if (!modal?.values.id) return;
    try {
      await deleteCalendarEvent(modal.values.id);
      setEvents((current) => current.filter((item) => item.id !== modal.values.id));
      setModal(null);
    } catch (deleteError) {
      setError(readApiErrorMessage(deleteError, "Calendar delete failed."));
    }
  }

  return (
    <TerminalPanel title="Calendar Command Center" label="External Constraints" action={<CalendarPlus className="h-4 w-4 text-accent" />}>
      <div className="life-terminal-calendar rounded-md border border-line bg-[#090f1a] p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          height={640}
          nowIndicator
          selectable
          editable
          selectMirror
          events={calendarEvents}
          dateClick={(arg) => openCreate(arg.date)}
          select={(arg) => openCreate(arg.start, arg.end)}
          eventClick={(arg) => openEdit(arg.event.extendedProps as LifeTerminalEvent)}
          eventDrop={(arg) => void patchEventTime(arg.event.id, arg.event.start, arg.event.end)}
          eventResize={(arg) => void patchEventTime(arg.event.id, arg.event.start, arg.event.end)}
          eventClassNames={(arg) => [`fc-impact-${String(arg.event.extendedProps.impact ?? "medium")}`]}
        />
      </div>
      {error ? <p className="mt-2 rounded-md border border-risk/50 bg-risk/10 px-3 py-2 text-sm text-risk">{error}</p> : null}
      {modal ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 px-4 backdrop-blur-sm">
          <form onSubmit={saveEvent} className="w-full max-w-2xl rounded-md border border-line bg-[#080e19] p-4 shadow-2xl shadow-black">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Calendar Event</p>
                <h3 className="text-lg font-semibold text-slate-50">{modal.mode === "create" ? "Add event" : "Edit event"}</h3>
              </div>
              <IconButton type="button" onClick={() => setModal(null)} title="Close">
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <TextInput value={modal.values.title} onChange={(event) => setModal({ ...modal, values: { ...modal.values, title: event.target.value } })} placeholder="Event title" />
              </div>
              <SelectInput value={modal.values.type} onChange={(event) => setModal({ ...modal, values: { ...modal.values, type: event.target.value } })} className="w-full">
                {EVENT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectInput>
              <SelectInput value={modal.values.impact} onChange={(event) => setModal({ ...modal, values: { ...modal.values, impact: event.target.value } })} className="w-full">
                {EVENT_IMPACTS.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectInput>
              <TextInput type="datetime-local" value={modal.values.start} onChange={(event) => setModal({ ...modal, values: { ...modal.values, start: event.target.value } })} />
              <TextInput type="datetime-local" value={modal.values.end} onChange={(event) => setModal({ ...modal, values: { ...modal.values, end: event.target.value } })} />
              <QuickSlider label="Expected Stress" value={modal.values.expectedStress} onChange={(expectedStress) => setModal({ ...modal, values: { ...modal.values, expectedStress } })} />
              <QuickSlider label="Preparation Load" value={modal.values.expectedPreparationLoad} onChange={(expectedPreparationLoad) => setModal({ ...modal, values: { ...modal.values, expectedPreparationLoad } })} />
            </div>
            <div className="mt-4 flex justify-between gap-2">
              {modal.mode === "edit" ? (
                <IconButton type="button" onClick={deleteEvent} className="border-risk/50 text-risk hover:border-risk hover:text-risk">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </IconButton>
              ) : <span />}
              <PrimaryButton disabled={!modal.values.title.trim()}>
                <Plus className="h-4 w-4" />
                {modal.mode === "create" ? "Add event" : "Save event"}
              </PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </TerminalPanel>
  );
}

function QuickSlider({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between font-mono text-[11px] uppercase text-slate-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full" />
    </label>
  );
}

function toInputDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60_000);
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
