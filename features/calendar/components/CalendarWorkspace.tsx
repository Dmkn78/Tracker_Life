"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarEventForm } from "@/components/CalendarEventForm";
import { Panel } from "@/components/ui";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent
} from "@/features/calendar/api/calendarEventsApi";
import {
  createCalendarEventWriteCoordinator,
  type CalendarEventWriteCoordinator
} from "@/features/calendar/application/calendarEventWriteCoordinator";
import {
  createCalendarRequestGate,
  runCalendarMutation
} from "@/features/calendar/application/calendarRequestGate";
import {
  CalendarEngine,
  type CalendarEngineVariant
} from "@/features/calendar/components/CalendarEngine";
import type {
  CalendarLayerId,
  CalendarVisibleRange
} from "@/features/calendar/domain/calendarLayers";
import type { CalendarEvent } from "@/features/calendar/domain/calendarEvent";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { listCompanies } from "@/features/shared/api/companiesApi";
import type { Company } from "@/features/shared/domain/tagCompany";
import { listTodoTasksInRange } from "@/features/todo/api/todoApi";
import type { TodoTask } from "@/features/todo/domain/todoTask";
import { loadCalendarAllocationPlans } from "@/features/time-allocation/api/timeAllocationApi";
import type { CalendarAllocationPlan } from "@/features/time-allocation/domain/timeAllocation";
import { loadCalendarRoutinePlans } from "@/features/habits/api/habitsApi";
import type { CalendarRoutinePlan } from "@/features/habits/domain/habit";
import { ApiError } from "@/lib/http/apiClient";

type EventDraft = {
  id?: string;
  title: string;
  type: string;
  impact: string;
  start: string;
  end: string;
  expectedStress: number;
  expectedPreparationLoad: number;
  companyName: string;
};

type EventEditorState = {
  mode: "create" | "edit";
  values: EventDraft;
};

type CalendarWorkspaceProps = {
  today: string;
  variant: CalendarEngineVariant;
  initialEvents?: CalendarEvent[];
  availableLayerIds?: readonly CalendarLayerId[];
};

const PAGE_LAYER_IDS: readonly CalendarLayerId[] = ["events", "todo", "allocations", "routines"];

export function CalendarWorkspace({
  today,
  variant,
  initialEvents = [],
  availableLayerIds = PAGE_LAYER_IDS
}: CalendarWorkspaceProps) {
  const { translate } = useLocale();
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [allocations, setAllocations] = useState<CalendarAllocationPlan[]>([]);
  const [routines, setRoutines] = useState<CalendarRoutinePlan[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [enabledLayerIds, setEnabledLayerIds] = useState<ReadonlySet<CalendarLayerId>>(
    () => new Set(availableLayerIds)
  );
  const [editor, setEditor] = useState<EventEditorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const visibleRangeRef = useRef<CalendarVisibleRange | null>(null);
  const editorOpenerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const mutationInFlightRef = useRef(false);
  const requestGateRef = useRef(createCalendarRequestGate());
  const eventWriteCoordinatorRef = useRef<CalendarEventWriteCoordinator | null>(null);

  if (!eventWriteCoordinatorRef.current) {
    eventWriteCoordinatorRef.current = createCalendarEventWriteCoordinator({
      executeWrite: (eventId, write) => updateCalendarEvent({ id: eventId, ...write }),
      publishEvent: (projectedEvent) => {
        if (!requestGateRef.current.isDisposed()) {
          setEvents((currentEvents) => upsertCalendarEvent(currentEvents, projectedEvent));
        }
      }
    });
  }

  const loadVisibleRange = useCallback(async (range: CalendarVisibleRange): Promise<void> => {
    visibleRangeRef.current = range;
    const calendarRead = requestGateRef.current.beginRead();
    if (!calendarRead) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const shouldLoadTasks = availableLayerIds.includes("todo");
      const shouldLoadAllocations = availableLayerIds.includes("allocations");
      const shouldLoadRoutines = availableLayerIds.includes("routines");
      const [loadedEvents, loadedTasks, loadedAllocations, loadedRoutines] = await Promise.all([
        listCalendarEvents({ ...range, signal: calendarRead.signal }),
        shouldLoadTasks
          ? listTodoTasksInRange({ from: range.from, to: range.to, signal: calendarRead.signal })
          : Promise.resolve([]),
        shouldLoadAllocations
          ? loadCalendarAllocationPlans(range.from, range.to, calendarRead.signal)
          : Promise.resolve([]),
        shouldLoadRoutines
          ? loadCalendarRoutinePlans(range.from, range.to, calendarRead.signal)
          : Promise.resolve([])
      ]);
      if (calendarRead.signal.aborted || !requestGateRef.current.isCurrentRead(calendarRead.generation)) {
        return;
      }
      const synchronizedEvents = loadedEvents.map((event) =>
        eventWriteCoordinatorRef.current!.synchronizeConfirmedEvent(event)
      );
      setEvents(synchronizedEvents.sort(compareCalendarEvents));
      setTasks(loadedTasks.filter((task) => Boolean(task.date)));
      setAllocations(loadedAllocations);
      setRoutines(loadedRoutines);
    } catch (error: unknown) {
      if (!calendarRead.signal.aborted && requestGateRef.current.isCurrentRead(calendarRead.generation)) {
        setLoadError(readApiErrorMessage(error, translate("calendar.loadError")));
      }
    } finally {
      if (requestGateRef.current.isCurrentRead(calendarRead.generation)) setIsLoading(false);
    }
  }, [availableLayerIds, translate]);

  useEffect(() => {
    const requestController = new AbortController();
    void listCompanies(requestController.signal).then(setCompanies).catch(() => undefined);
    return () => requestController.abort();
  }, []);

  useEffect(() => {
    return () => requestGateRef.current.dispose();
  }, []);

  useEffect(() => {
    if (editor && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [editor]);

  function toggleLayer(layerId: CalendarLayerId): void {
    setEnabledLayerIds((currentLayerIds) => {
      const nextLayerIds = new Set(currentLayerIds);
      if (nextLayerIds.has(layerId)) nextLayerIds.delete(layerId);
      else nextLayerIds.add(layerId);
      return nextLayerIds;
    });
  }

  function openCreateEvent(start: Date, end: Date): void {
    editorOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setWriteError(null);
    setEditor({
      mode: "create",
      values: {
        title: "",
        type: "personal",
        impact: "medium",
        start: toInputDateTime(start),
        end: toInputDateTime(end),
        expectedStress: 50,
        expectedPreparationLoad: 50,
        companyName: ""
      }
    });
  }

  function openEditEvent(event: CalendarEvent): void {
    editorOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setWriteError(null);
    setEditor({
      mode: "edit",
      values: {
        id: event.id,
        title: event.title,
        type: event.type,
        impact: event.impact,
        start: toInputDateTime(event.start),
        end: toInputDateTime(event.end),
        expectedStress: event.expectedStress,
        expectedPreparationLoad: event.expectedPreparationLoad,
        companyName: event.companyName ?? ""
      }
    });
  }

  async function saveEvent(submitEvent: React.FormEvent): Promise<void> {
    submitEvent.preventDefault();
    if (!editor || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setWriteError(null);
    setIsSaving(true);
    try {
      const write = toCalendarEventWrite(editor.values);
      if (editor.mode === "create") {
        const createdEvent = await runCalendarMutation({
          requestGate: requestGateRef.current,
          mutate: () => createCalendarEvent(write),
          whenIdle: () => Promise.resolve(),
          reload: reloadVisibleRange
        });
        if (requestGateRef.current.isDisposed()) return;
        eventWriteCoordinatorRef.current!.synchronizeConfirmedEvent(createdEvent);
        setEvents((currentEvents) => upsertCalendarEvent(currentEvents, createdEvent));
      } else {
        const eventId = editor.values.id;
        const currentEvent = events.find((event) => event.id === eventId);
        if (!eventId || !currentEvent) throw new Error("Calendar event id is missing");
        eventWriteCoordinatorRef.current!.synchronizeConfirmedEvent(currentEvent);
        await runCalendarMutation({
          requestGate: requestGateRef.current,
          mutate: () => eventWriteCoordinatorRef.current!.enqueueWrite(eventId, write),
          whenIdle: () => eventWriteCoordinatorRef.current!.whenIdle(eventId),
          reload: reloadVisibleRange
        });
      }
      if (!requestGateRef.current.isDisposed()) closeEditor();
    } catch (error: unknown) {
      if (!requestGateRef.current.isDisposed()) setWriteError(readApiErrorMessage(error, translate("calendar.saveError")));
    } finally {
      mutationInFlightRef.current = false;
      if (!requestGateRef.current.isDisposed()) setIsSaving(false);
    }
  }

  async function deleteEvent(): Promise<void> {
    const eventId = editor?.values.id;
    if (!eventId || mutationInFlightRef.current || !window.confirm(translate("calendar.deleteConfirm"))) return;
    mutationInFlightRef.current = true;
    setWriteError(null);
    setIsSaving(true);
    try {
      await runCalendarMutation({
        requestGate: requestGateRef.current,
        mutate: async () => {
          await eventWriteCoordinatorRef.current!.whenIdle(eventId);
          await deleteCalendarEvent(eventId);
        },
        whenIdle: () => eventWriteCoordinatorRef.current!.whenIdle(eventId),
        reload: reloadVisibleRange
      });
      if (!requestGateRef.current.isDisposed()) {
        setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
        closeEditor();
      }
    } catch (error: unknown) {
      if (!requestGateRef.current.isDisposed()) setWriteError(readApiErrorMessage(error, translate("calendar.deleteError")));
    } finally {
      mutationInFlightRef.current = false;
      if (!requestGateRef.current.isDisposed()) setIsSaving(false);
    }
  }

  async function changeEventTime(
    eventId: string,
    start: Date,
    end: Date | null
  ): Promise<void> {
    const currentEvent = events.find((event) => event.id === eventId);
    if (!currentEvent) return;
    eventWriteCoordinatorRef.current!.synchronizeConfirmedEvent(currentEvent);
    setWriteError(null);
    try {
      await runCalendarMutation({
        requestGate: requestGateRef.current,
        mutate: () => eventWriteCoordinatorRef.current!.enqueueWrite(eventId, {
          start: start.toISOString(),
          end: (end ?? addHours(start, 1)).toISOString()
        }),
        whenIdle: () => eventWriteCoordinatorRef.current!.whenIdle(eventId),
        reload: reloadVisibleRange
      });
    } catch (error: unknown) {
      if (!requestGateRef.current.isDisposed()) {
        setWriteError(readApiErrorMessage(error, translate("calendar.moveError")));
      }
    }
  }

  function reloadVisibleRange(): Promise<void> {
    return visibleRangeRef.current
      ? loadVisibleRange(visibleRangeRef.current)
      : Promise.resolve();
  }

  function closeEditor(): void {
    if (mutationInFlightRef.current) return;
    dialogRef.current?.close();
    setEditor(null);
    window.requestAnimationFrame(() => editorOpenerRef.current?.focus());
  }

  return (
    <div>
      <CalendarEngine
        events={events}
        tasks={tasks}
        allocations={allocations}
        routines={routines}
        initialDate={today}
        variant={variant}
        availableLayerIds={availableLayerIds}
        enabledLayerIds={enabledLayerIds}
        isLoading={isLoading}
        onToggleLayer={toggleLayer}
        onVisibleRangeChange={(range) => void loadVisibleRange(range)}
        onCreateEvent={openCreateEvent}
        onEditEvent={openEditEvent}
        onChangeEventTime={changeEventTime}
      />

      {loadError || writeError ? (
        <p role="alert" className="mt-3 rounded-xl bg-risk/10 px-3 py-2 text-sm text-risk ring-1 ring-risk/20">
          {writeError ?? loadError}
        </p>
      ) : null}

      {editor ? (
        <dialog
          ref={dialogRef}
          className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/65 px-4 py-6 backdrop-blur-sm"
          aria-labelledby="calendar-event-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            closeEditor();
          }}
        >
          <Panel className="max-h-[92vh] w-full max-w-xl overflow-y-auto">
            {writeError ? (
              <p role="alert" className="mb-4 rounded-xl bg-risk/10 px-3 py-2 text-sm text-risk">
                {writeError}
              </p>
            ) : null}
            <CalendarEventForm
              {...editor.values}
              mode={editor.mode}
              companies={companies}
              isSaving={isSaving}
              onClose={closeEditor}
              onDelete={editor.mode === "edit" ? () => void deleteEvent() : undefined}
              onSubmit={(event) => void saveEvent(event)}
              onChange={(patch) => {
                setEditor((currentEditor) => currentEditor
                  ? { ...currentEditor, values: { ...currentEditor.values, ...patch } }
                  : currentEditor
                );
              }}
            />
          </Panel>
        </dialog>
      ) : null}
    </div>
  );
}

function toCalendarEventWrite(values: EventDraft) {
  return {
    title: values.title.trim(),
    type: values.type,
    impact: values.impact,
    start: new Date(values.start).toISOString(),
    end: new Date(values.end).toISOString(),
    expectedStress: values.expectedStress,
    expectedPreparationLoad: values.expectedPreparationLoad,
    companyName: values.companyName.trim()
  };
}

function upsertCalendarEvent(events: CalendarEvent[], event: CalendarEvent): CalendarEvent[] {
  const nextEvents = events.some((candidate) => candidate.id === event.id)
    ? events.map((candidate) => candidate.id === event.id ? event : candidate)
    : [...events, event];
  return nextEvents.sort(compareCalendarEvents);
}

function compareCalendarEvents(left: CalendarEvent, right: CalendarEvent): number {
  return left.start.localeCompare(right.start);
}

function toInputDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60_000);
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
