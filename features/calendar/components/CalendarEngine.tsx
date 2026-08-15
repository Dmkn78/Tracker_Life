"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import frLocale from "@fullcalendar/core/locales/fr";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  GhostButton,
  SecondaryButton,
  Segmented,
  SegmentedButton
} from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { TranslationKey } from "@/features/interface/localization/messages";
import {
  buildCalendarDisplayEvents,
  CALENDAR_LAYERS,
  isEditableCalendarLayer,
  toCalendarVisibleRange,
  type CalendarLayerId,
  type CalendarVisibleRange
} from "@/features/calendar/domain/calendarLayers";
import type { CalendarEvent } from "@/features/calendar/domain/calendarEvent";
import type { TodoTask } from "@/features/todo/domain/todoTask";
import type { CalendarAllocationPlan } from "@/features/time-allocation/domain/timeAllocation";
import type { CalendarRoutinePlan } from "@/features/habits/domain/habit";

export type CalendarEngineVariant = "page" | "terminal";

type CalendarViewName = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

type CalendarEngineProps = {
  events: CalendarEvent[];
  tasks: TodoTask[];
  allocations: CalendarAllocationPlan[];
  routines: CalendarRoutinePlan[];
  initialDate: string;
  variant: CalendarEngineVariant;
  availableLayerIds: readonly CalendarLayerId[];
  enabledLayerIds: ReadonlySet<CalendarLayerId>;
  isLoading: boolean;
  onToggleLayer: (layerId: CalendarLayerId) => void;
  onVisibleRangeChange: (range: CalendarVisibleRange) => void;
  onCreateEvent: (start: Date, end: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onChangeEventTime: (eventId: string, start: Date, end: Date | null) => Promise<void>;
};

const VIEW_LABEL_KEYS: Record<CalendarViewName, TranslationKey> = {
  dayGridMonth: "calendar.view.month",
  timeGridWeek: "calendar.view.week",
  timeGridDay: "calendar.view.day"
};

const LAYER_LABEL_KEYS: Record<CalendarLayerId, TranslationKey> = {
  events: "calendar.layer.events",
  todo: "calendar.layer.todo",
  allocations: "calendar.layer.allocations",
  routines: "calendar.layer.routines"
};

const CALENDAR_VIEWS = Object.keys(VIEW_LABEL_KEYS) as CalendarViewName[];

export function CalendarEngine({
  events,
  tasks,
  allocations,
  routines,
  initialDate,
  variant,
  availableLayerIds,
  enabledLayerIds,
  isLoading,
  onToggleLayer,
  onVisibleRangeChange,
  onCreateEvent,
  onEditEvent,
  onChangeEventTime
}: CalendarEngineProps) {
  const { locale, translate } = useLocale();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [viewName, setViewName] = useState<CalendarViewName>("timeGridWeek");
  const [viewTitle, setViewTitle] = useState("");
  const displayEvents = useMemo(
    () => buildCalendarDisplayEvents({ events, tasks, allocations, routines, enabledLayerIds }),
    [allocations, enabledLayerIds, events, routines, tasks]
  );
  const availableLayers = CALENDAR_LAYERS.filter(
    (layer) => layer.isAvailable && availableLayerIds.includes(layer.id)
  );
  const minimumCalendarWidth = viewName === "timeGridDay" ? "min-w-0" : "min-w-[680px] sm:min-w-0";

  function navigate(action: "previous" | "next" | "today"): void {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;
    if (action === "previous") calendarApi.prev();
    if (action === "next") calendarApi.next();
    if (action === "today") calendarApi.today();
  }

  function changeView(nextViewName: CalendarViewName): void {
    calendarRef.current?.getApi().changeView(nextViewName);
    setViewName(nextViewName);
  }

  function createEventFromKeyboard(): void {
    const visibleDate = calendarRef.current?.getApi().getDate() ?? new Date(initialDate);
    const start = atLocalHour(visibleDate, 9);
    onCreateEvent(start, addHours(start, 1));
  }

  return (
    <div className={`calendar-engine calendar-engine-${variant}`}>
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <SecondaryButton
              aria-label={translate("calendar.previous")}
              className="min-w-11 px-3"
              onClick={() => navigate("previous")}
            >
              <ChevronLeft className="h-4 w-4" />
            </SecondaryButton>
            <SecondaryButton
              aria-label={translate("calendar.next")}
              className="min-w-11 px-3"
              onClick={() => navigate("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </SecondaryButton>
            <GhostButton onClick={() => navigate("today")}>{translate("calendar.today")}</GhostButton>
            <SecondaryButton aria-label={translate("calendar.addEvent")} onClick={createEventFromKeyboard}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{translate("calendar.addEvent")}</span>
            </SecondaryButton>
          </div>
          <h2 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-ink sm:text-base">
            {viewTitle}
          </h2>
          {isLoading ? (
            <span className="text-xs text-muted" role="status">{translate("calendar.loading")}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Segmented aria-label={translate("calendar.viewOptions")} className="w-full sm:w-auto">
            {CALENDAR_VIEWS.map((calendarView) => (
              <SegmentedButton
                key={calendarView}
                active={viewName === calendarView}
                className="flex-1 sm:flex-none"
                onClick={() => changeView(calendarView)}
              >
                {translate(VIEW_LABEL_KEYS[calendarView])}
              </SegmentedButton>
            ))}
          </Segmented>
          {availableLayers.length > 1 ? (
            <div className="flex flex-wrap gap-2" aria-label={translate("calendar.layers")} role="group">
              {availableLayers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  aria-pressed={enabledLayerIds.has(layer.id)}
                  className={`focus-ring calendar-layer-toggle calendar-layer-toggle-${layer.id} rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-line ${
                    enabledLayerIds.has(layer.id) ? "bg-panel2 text-ink" : "bg-transparent text-muted opacity-60"
                  }`}
                  onClick={() => onToggleLayer(layer.id)}
                >
                  {translate(LAYER_LABEL_KEYS[layer.id])}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="thin-scrollbar overflow-x-auto rounded-2xl border border-line bg-shell/55">
        <div className={minimumCalendarWidth}>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialDate={initialDate}
            initialView="timeGridWeek"
            headerToolbar={false}
            height={variant === "terminal" ? 560 : 720}
            locale={locale}
            locales={[frLocale]}
            firstDay={1}
            nowIndicator
            selectable
            selectMirror
            editable
            eventStartEditable
            eventDurationEditable
            stickyHeaderDates
            expandRows
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            events={displayEvents}
            datesSet={(view) => {
              setViewTitle(view.view.title);
              setViewName(view.view.type as CalendarViewName);
              onVisibleRangeChange(toCalendarVisibleRange(view.startStr, view.endStr));
            }}
            dateClick={(selection) => {
              const start = selection.allDay ? atLocalHour(selection.date, 9) : selection.date;
              onCreateEvent(start, addHours(start, 1));
            }}
            select={(selection) => {
              if (selection.allDay) {
                const start = atLocalHour(selection.start, 9);
                onCreateEvent(start, addHours(start, 1));
                return;
              }
              onCreateEvent(selection.start, selection.end);
            }}
            eventClick={(selection) => {
              if (selection.event.extendedProps.layerId !== "events" || selection.event.extendedProps.interactive === false) return;
              onEditEvent(selection.event.extendedProps.source as CalendarEvent);
            }}
            eventDrop={(change) => {
              if (!isEditableCalendarLayer(change.event.extendedProps.layerId as CalendarLayerId)) {
                change.revert();
                return;
              }
              if (!change.event.start) return;
              void onChangeEventTime(
                String(change.event.extendedProps.sourceId),
                change.event.start,
                change.event.end
              );
            }}
            eventResize={(change) => {
              if (!isEditableCalendarLayer(change.event.extendedProps.layerId as CalendarLayerId)) {
                change.revert();
                return;
              }
              if (!change.event.start) return;
              void onChangeEventTime(
                String(change.event.extendedProps.sourceId),
                change.event.start,
                change.event.end
              );
            }}
            eventContent={(eventRender) => (
              <div className="calendar-event-content">
                <span className="calendar-event-layer-mark" aria-hidden="true" />
                <span className="calendar-event-title">{eventRender.event.title}</span>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60_000);
}

function atLocalHour(date: Date, hour: number): Date {
  const result = new Date(date);
  result.setHours(hour, 0, 0, 0);
  return result;
}
