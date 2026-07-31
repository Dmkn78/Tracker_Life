"use client";

import { CalendarPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { CalendarEventForm } from "@/components/CalendarEventForm";
import { Panel, PrimaryButton } from "@/components/ui";

type EventItem = {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
  impact: string;
  expectedStress: number;
  expectedPreparationLoad: number;
};

export function CalendarClient({ today }: { today: string }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("personal");
  const [impact, setImpact] = useState("medium");
  const [start, setStart] = useState(`${today}T09:00`);
  const [end, setEnd] = useState(`${today}T10:00`);
  const [expectedStress, setExpectedStress] = useState(50);
  const [expectedPreparationLoad, setExpectedPreparationLoad] = useState(50);

  async function load() {
    const data = await fetch(`/api/calendar-events?from=${today}`).then((response) => response.json());
    setEvents(data.events);
  }

  useEffect(() => {
    load();
  }, []);

  async function addEvent(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/calendar-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        type,
        impact,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        expectedStress,
        expectedPreparationLoad
      })
    });
    const data = await response.json();
    setEvents((current) => [...current, data.event].sort((a, b) => a.start.localeCompare(b.start)));
    setTitle("");
    setOpen(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">Calendar context</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-50">Events</h1>
        </div>
        <PrimaryButton onClick={() => setOpen(true)}>
          <CalendarPlus className="h-4 w-4" />
          Add calendar event
        </PrimaryButton>
      </div>

      <div className="grid gap-4">
        <div className="space-y-3">
          {events.length === 0 ? (
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
