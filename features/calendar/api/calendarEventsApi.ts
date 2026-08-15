import {
  expectJsonObject,
  expectNumber,
  expectOptionalNullableString,
  expectString,
  requestJson
} from "@/lib/http/apiClient";
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput
} from "../domain/calendarEvent";

export function listCalendarEvents(
  {
    from,
    to,
    eventStart,
    eventEndExclusive,
    signal
  }: {
    from: string;
    to: string;
    eventStart: string;
    eventEndExclusive: string;
    signal?: AbortSignal;
  }
): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({ from, to, eventStart, eventEndExclusive });
  return requestJson(
    `/api/calendar-events?${query.toString()}`,
    parseCalendarEventsResponse,
    { signal }
  );
}

export function createCalendarEvent(
  input: CreateCalendarEventInput
): Promise<CalendarEvent> {
  return requestJson("/api/calendar-events", parseCalendarEventResponse, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function updateCalendarEvent(
  input: UpdateCalendarEventInput
): Promise<CalendarEvent> {
  return requestJson("/api/calendar-events", parseCalendarEventResponse, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const query = new URLSearchParams({ id });
  await requestJson(
    `/api/calendar-events?${query.toString()}`,
    (payload) => {
      const response = expectJsonObject(payload, "delete calendar event response");
      if (response.ok !== true) throw new Error("delete calendar event response.ok must be true");
      return true;
    },
    { method: "DELETE" }
  );
}

function parseCalendarEventsResponse(payload: unknown): CalendarEvent[] {
  const response = expectJsonObject(payload, "calendar events response");
  if (!Array.isArray(response.events)) {
    throw new Error("calendar events response.events must be an array");
  }
  return response.events.map((event, index) =>
    parseCalendarEvent(event, `calendar events response.events[${index}]`)
  );
}

function parseCalendarEventResponse(payload: unknown): CalendarEvent {
  const response = expectJsonObject(payload, "calendar event response");
  return parseCalendarEvent(response.event, "calendar event response.event");
}

function parseCalendarEvent(payload: unknown, context: string): CalendarEvent {
  const event = expectJsonObject(payload, context);
  return {
    id: expectString(event.id, `${context}.id`),
    title: expectString(event.title, `${context}.title`),
    type: expectString(event.type, `${context}.type`),
    start: expectString(event.start, `${context}.start`),
    end: expectString(event.end, `${context}.end`),
    impact: expectString(event.impact, `${context}.impact`),
    expectedStress: expectNumber(event.expectedStress, `${context}.expectedStress`),
    expectedPreparationLoad: expectNumber(
      event.expectedPreparationLoad,
      `${context}.expectedPreparationLoad`
    ),
    companyId: expectOptionalNullableString(event.companyId, `${context}.companyId`),
    companyName: expectOptionalNullableString(event.companyName, `${context}.companyName`),
    companyColor: expectOptionalNullableString(event.companyColor, `${context}.companyColor`)
  };
}
