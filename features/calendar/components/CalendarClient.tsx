"use client";

import { CalendarPlus, ListTodo } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CalendarEventForm } from "@/components/CalendarEventForm";
import { Pill, Panel, PrimaryButton } from "@/components/ui";
import {
  createCalendarEvent,
  listCalendarEvents
} from "@/features/calendar/api/calendarEventsApi";
import type { CalendarEvent } from "@/features/calendar/domain/calendarEvent";
import { listCompanies } from "@/features/shared/api/companiesApi";
import type { Company } from "@/features/shared/domain/tagCompany";
import { listTodoTasksInRange } from "@/features/todo/api/todoApi";
import type { TodoTask } from "@/features/todo/domain/todoTask";
import { addDays } from "@/lib/dates";
import { ApiError } from "@/lib/http/apiClient";

type AgendaItem =
  | { kind: "event"; sortKey: string; event: CalendarEvent }
  | { kind: "task"; sortKey: string; task: TodoTask };

export function CalendarClient({ today }: { today: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<TodoTask[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
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
  const [companyName, setCompanyName] = useState("");

  const rangeEnd = useMemo(() => addDays(today, 30), [today]);

  useEffect(() => {
    const requestController = new AbortController();
    setLoadError(null);
    void Promise.all([
      listCalendarEvents(today, requestController.signal),
      listTodoTasksInRange({ from: today, to: rangeEnd, signal: requestController.signal })
    ])
      .then(([loadedEvents, loadedTasks]) => {
        setEvents(loadedEvents);
        setScheduledTasks(loadedTasks.filter((task) => Boolean(task.date)));
      })
      .catch((error: unknown) => {
        if (!requestController.signal.aborted) {
          setLoadError(readApiErrorMessage(error, "Unable to load the calendar."));
        }
      });
    return () => requestController.abort();
  }, [today, rangeEnd]);

  useEffect(() => {
    const requestController = new AbortController();
    void listCompanies(requestController.signal)
      .then(setCompanies)
      .catch(() => undefined);
    return () => requestController.abort();
  }, []);

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
        expectedPreparationLoad,
        companyName: companyName.trim() || undefined
      });
      setEvents((current) => [...current, createdEvent]);
      setTitle("");
      setCompanyName("");
      setOpen(false);
    } catch (error: unknown) {
      setSaveError(readApiErrorMessage(error, "Unable to create the calendar event."));
    }
  }

  const agenda: AgendaItem[] = useMemo(() => {
    const eventItems: AgendaItem[] = events.map((event) => ({ kind: "event", sortKey: event.start, event }));
    const taskItems: AgendaItem[] = scheduledTasks.map((task) => ({
      kind: "task",
      sortKey: `${task.date}T${task.startTime ?? "00:00"}`,
      task
    }));
    return [...eventItems, ...taskItems].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [events, scheduledTasks]);

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">Calendar context</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Events</h1>
          <p className="mt-1 text-sm text-muted">Scheduled tasks from To-do appear here automatically alongside standalone events.</p>
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
          ) : agenda.length === 0 ? (
            <Panel>
              <p className="text-sm text-muted">No upcoming events or scheduled tasks in the next 30 days.</p>
            </Panel>
          ) : null}
          {agenda.map((item) =>
            item.kind === "event" ? (
              <Panel key={`event-${item.event.id}`}>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink">{item.event.title}</h2>
                      {item.event.companyName ? (
                        <Pill style={{ backgroundColor: `${item.event.companyColor}22`, color: item.event.companyColor ?? undefined }}>
                          {item.event.companyName}
                        </Pill>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {item.event.type} · {new Date(item.event.start).toLocaleString()} ·{" "}
                      {new Date(item.event.end).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className="rounded-md border border-line bg-shell px-3 py-1 text-sm font-semibold text-ink">
                    {item.event.impact}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted">
                  <span>Stress {item.event.expectedStress}/100</span>
                  <span>Prep {item.event.expectedPreparationLoad}/100</span>
                </div>
              </Panel>
            ) : (
              <Panel key={`task-${item.task.id}`} className="ring-1 ring-accent/15">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill className="bg-accent/12 text-accent ring-accent/15">
                        <ListTodo className="mr-1 inline h-3 w-3" />
                        Task
                      </Pill>
                      <h2 className="text-lg font-semibold text-ink">{item.task.title}</h2>
                      {item.task.companyName ? (
                        <Pill style={{ backgroundColor: `${item.task.companyColor}22`, color: item.task.companyColor ?? undefined }}>
                          {item.task.companyName}
                        </Pill>
                      ) : null}
                      {item.task.tags.map((tag) => (
                        <Pill key={tag.id} style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>
                          {tag.name}
                        </Pill>
                      ))}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {item.task.date}
                      {item.task.startTime ? ` · ${item.task.startTime}${item.task.endTime ? `–${item.task.endTime}` : ""}` : ""}
                    </p>
                  </div>
                  <span className="rounded-md border border-line bg-shell px-3 py-1 text-sm font-semibold text-ink">
                    {item.task.status.replace("_", " ")}
                  </span>
                </div>
              </Panel>
            )
          )}
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
              companyName={companyName}
              companies={companies}
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
                if (typeof patch.companyName === "string") setCompanyName(patch.companyName);
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
