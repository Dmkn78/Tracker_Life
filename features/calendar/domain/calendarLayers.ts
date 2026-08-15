import type { TodoTask } from "@/features/todo/domain/todoTask";
import type { CalendarRoutinePlan } from "@/features/habits/domain/habit";
import type { CalendarAllocationPlan } from "@/features/time-allocation/domain/timeAllocation";
import type { CalendarEvent } from "./calendarEvent";

export const CALENDAR_LAYER_IDS = ["events", "todo", "allocations", "routines"] as const;
export type CalendarLayerId = (typeof CALENDAR_LAYER_IDS)[number];

export type CalendarLayerDefinition = {
  id: CalendarLayerId;
  className: string;
  isAvailable: boolean;
  isEditable: boolean;
};

export type CalendarVisibleRange = {
  from: string;
  to: string;
  eventStart: string;
  eventEndExclusive: string;
};

export type CalendarDisplayEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  editable: boolean;
  startEditable: boolean;
  durationEditable: boolean;
  interactive: boolean;
  classNames: string[];
  backgroundColor?: string;
  borderColor?: string;
  extendedProps: {
    layerId: CalendarLayerId;
    sourceId: string;
    source: CalendarEvent | TodoTask | CalendarAllocationPlan | CalendarRoutinePlan;
    interactive: boolean;
  };
};

export const CALENDAR_LAYERS: readonly CalendarLayerDefinition[] = [
  {
    id: "events",
    className: "calendar-layer-events",
    isAvailable: true,
    isEditable: true
  },
  {
    id: "todo",
    className: "calendar-layer-todo",
    isAvailable: true,
    isEditable: false
  },
  {
    id: "allocations",
    className: "calendar-layer-allocations",
    isAvailable: true,
    isEditable: false
  },
  {
    id: "routines",
    className: "calendar-layer-routines",
    isAvailable: true,
    isEditable: false
  }
] as const;

export function toCalendarVisibleRange(
  visibleStart: string,
  visibleEndExclusive: string
): CalendarVisibleRange {
  const from = visibleStart.slice(0, 10);
  const endExclusiveDate = visibleEndExclusive.slice(0, 10);
  return {
    from,
    to: shiftUtcDateKey(endExclusiveDate, -1),
    eventStart: visibleStart,
    eventEndExclusive: visibleEndExclusive
  };
}

export function buildCalendarDisplayEvents({
  events,
  tasks,
  allocations = [],
  routines = [],
  enabledLayerIds
}: {
  events: CalendarEvent[];
  tasks: TodoTask[];
  allocations?: CalendarAllocationPlan[];
  routines?: CalendarRoutinePlan[];
  enabledLayerIds: ReadonlySet<CalendarLayerId>;
}): CalendarDisplayEvent[] {
  const displayEvents: CalendarDisplayEvent[] = [];
  if (enabledLayerIds.has("events")) {
    displayEvents.push(...events.map(toCalendarEventDisplay));
  }
  if (enabledLayerIds.has("todo")) {
    displayEvents.push(...tasks.flatMap(toTodoTaskDisplay));
  }
  if (enabledLayerIds.has("allocations")) {
    displayEvents.push(...allocations.map(toAllocationPlanDisplay));
  }
  if (enabledLayerIds.has("routines")) {
    displayEvents.push(...routines.map(toRoutinePlanDisplay));
  }
  return displayEvents;
}

function toRoutinePlanDisplay(routine: CalendarRoutinePlan): CalendarDisplayEvent {
  const layer = getCalendarLayer("routines");
  return {
    id: `routine:${routine.id}`,
    title: routine.title,
    start: routine.start,
    end: routine.end,
    allDay: false,
    editable: false,
    startEditable: false,
    durationEditable: false,
    interactive: false,
    classNames: [layer.className],
    extendedProps: { layerId: layer.id, sourceId: routine.id, source: routine, interactive: false }
  };
}

function toAllocationPlanDisplay(plan: CalendarAllocationPlan): CalendarDisplayEvent {
  const layer = getCalendarLayer("allocations");
  return {
    id: `allocation:${plan.id}`,
    title: plan.title,
    start: plan.startDate,
    end: plan.endExclusive,
    allDay: true,
    editable: false,
    startEditable: false,
    durationEditable: false,
    interactive: false,
    classNames: [layer.className, `calendar-allocation-${plan.period}`],
    backgroundColor: withAlpha(plan.color, "33"),
    borderColor: plan.color,
    extendedProps: { layerId: layer.id, sourceId: plan.id, source: plan, interactive: false }
  };
}

function withAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

export function isEditableCalendarLayer(layerId: CalendarLayerId): boolean {
  return CALENDAR_LAYERS.find((layer) => layer.id === layerId)?.isEditable ?? false;
}

function toCalendarEventDisplay(event: CalendarEvent): CalendarDisplayEvent {
  const layer = getCalendarLayer("events");
  return {
    id: `event:${event.id}`,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: false,
    editable: layer.isEditable,
    startEditable: layer.isEditable,
    durationEditable: layer.isEditable,
    interactive: true,
    classNames: [layer.className, `fc-impact-${event.impact}`],
    extendedProps: { layerId: layer.id, sourceId: event.id, source: event, interactive: true }
  };
}

function toTodoTaskDisplay(task: TodoTask): CalendarDisplayEvent[] {
  if (!task.date) return [];
  const layer = getCalendarLayer("todo");
  const hasStartTime = Boolean(task.startTime);
  return [{
    id: `todo:${task.id}`,
    title: task.title,
    start: hasStartTime ? `${task.date}T${task.startTime}` : task.date,
    end: hasStartTime && task.endTime ? `${task.date}T${task.endTime}` : undefined,
    allDay: !hasStartTime,
    editable: layer.isEditable,
    startEditable: layer.isEditable,
    durationEditable: layer.isEditable,
    interactive: false,
    classNames: [layer.className, `calendar-task-${task.status}`],
    extendedProps: { layerId: layer.id, sourceId: task.id, source: task, interactive: false }
  }];
}

function getCalendarLayer(layerId: CalendarLayerId): CalendarLayerDefinition {
  const layer = CALENDAR_LAYERS.find((candidate) => candidate.id === layerId);
  if (!layer) throw new Error(`Unknown calendar layer: ${layerId}`);
  return layer;
}

function shiftUtcDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
