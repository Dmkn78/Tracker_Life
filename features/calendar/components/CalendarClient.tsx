"use client";

import { CalendarPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { CalendarEventForm } from "@/components/CalendarEventForm";
import { Panel, PrimaryButton } from "@/components/ui";
import {
  createCalendarEvent,
  listCalendarEvents
} from "@/features/calendar/api/calendarEventsApi";
import type { CalendarEvent } from "@/features/calendar/domain/calendarEvent";
import { ApiError } from "@/lib/http/apiClient";

export function CalendarClient({ today }: { today: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("personal");
  const [impact, setImpact] = useState("medium");
  const [start, setStart] = useState(`${today}T09:00`);
  const [end, setEnd] = useState(`${today}T10:00`);
  const [expectedStress, setExpectedStress] = useState(50);
  const [expectedPreparationLoad, setExpectedPreparationLoad] = useState(50);

  useEffect(() => {
    const requestController = new AbortController();
    setLoadError(null);
    void listCalendarEvents(today, requestController.signal)
      .then(setEvents)
      .catch((error: unknown) => {
        if (!requestController.signal.aborted) {
          setLoadError(readApiErrorMessage(error, "Unable to load calendar events."));
        }
      });
    return () => requestController.abort();
  }, [today]);

  async function addEvent(event: React.FormEvent) {
    event.preventDefault();
    setSaveError(null);
    try {
      const createdEvent = await createCalendarEvent({
        title,
        type,
        impact,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        expectedStress,
        expectedPreparationLoad
      });
      setEvents((current) =>
        [...current, createdEvent].sort((a, b) => a.start.localeCompare(b.start))
      );
      setTitle("");
      setOpen(false);
    } catch (error: unknown) {
      setSaveError(readApiErrorMessage(error, "Unable to create the calendar event."));
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">Calendar context</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-50">Events</h1>
        </div>
        <PrimaryButton
          onClick={() => {
            setSaveError(null);
            setOpen(true);
          }}
        >
          <CalendarPlus className="h-4 w-4" />
          Add calendar event
        </PrimaryButton>
      </div>

      <div className="grid gap-4">
        <div className="space-y-3">
          {loadError ? (
            <Panel>
              <p role="alert" className="text-sm text-red-300">
                {loadError}
              </p>
            </Panel>
          ) : events.length === 0 ? (
            <Panel>
              <p className="text-sm text-slate-400">No upcoming events in the next 30 days.</p>
            </Panel>
          ) : null}
          {events.map((event) => (
            <Panel key={event.id}>
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">{event.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {event.type} · {new Date(event.start).toLocaleString()} ·{" "}
                    {new Date(event.end).toLocaleTimeString()}
                  </p>
                </div>
                <span className="rounded-md border border-line bg-shell px-3 py-1 text-sm font-semibold text-slate-200">
                  {event.impact}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-400">
                <span>Stress {event.expectedStress}/100</span>
                <span>Prep {event.expectedPreparationLoad}/100</span>
              </div>
            </Panel>
          ))}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
          <Panel className="max-h-[92vh] w-full max-w-xl overflow-y-auto">
            {saveError ? (
              <p role="alert" className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {saveError}
              </p>
            ) : null}
            <CalendarEventForm
              title={title}
              type={type}
              impact={impact}
              start={start}
              end={end}
              expectedStress={expectedStress}
              expectedPreparationLoad={expectedPreparationLoad}
              onClose={() => setOpen(false)}
              onSubmit={addEvent}
              onChange={(patch) => {
                if (typeof patch.title === "string") setTitle(patch.title);
                if (typeof patch.type === "string") setType(patch.type);
                if (typeof patch.impact === "string") setImpact(patch.impact);
                if (typeof patch.start === "string") setStart(patch.start);
                if (typeof patch.end === "string") setEnd(patch.end);
                if (typeof patch.expectedStress === "number") setExpectedStress(patch.expectedStress);
                if (typeof patch.expectedPreparationLoad === "number") setExpectedPreparationLoad(patch.expectedPreparationLoad);
              }}
            />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
