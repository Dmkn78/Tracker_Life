import type {
  CalendarEvent,
  UpdateCalendarEventInput
} from "@/features/calendar/domain/calendarEvent";
import { createSerializedWriteCoordinator } from "@/features/shared/application/serializedWriteCoordinator";

export type CalendarEventWrite = Omit<UpdateCalendarEventInput, "id">;

export type CalendarEventWriteCoordinator = {
  synchronizeConfirmedEvent: (event: CalendarEvent) => CalendarEvent;
  enqueueWrite: (eventId: string, write: CalendarEventWrite) => Promise<CalendarEvent>;
  whenIdle: (eventId: string) => Promise<void>;
};

export function createCalendarEventWriteCoordinator({
  executeWrite,
  publishEvent
}: {
  executeWrite: (eventId: string, write: CalendarEventWrite) => Promise<CalendarEvent>;
  publishEvent: (event: CalendarEvent) => void;
}): CalendarEventWriteCoordinator {
  const coordinator = createSerializedWriteCoordinator<string, CalendarEvent, CalendarEventWrite>({
    applyWrite: (event, write) => ({ ...event, ...write }),
    executeWrite,
    publishState: (_eventId, event) => publishEvent(event)
  });
  return {
    synchronizeConfirmedEvent: (event) => coordinator.synchronizeConfirmedState(event.id, event),
    enqueueWrite: coordinator.enqueueWrite,
    whenIdle: coordinator.whenIdle
  };
}
