"use client";

import { TerminalCalendarWorkspace } from "@/features/calendar/components/TerminalCalendarWorkspace";
import type { LifeTerminalEvent } from "@/features/life-terminal/domain/lifeTerminal";

export function CalendarCommandCenter({
  today,
  initialEvents
}: {
  today: string;
  initialEvents: LifeTerminalEvent[];
}) {
  return <TerminalCalendarWorkspace today={today} initialEvents={initialEvents} />;
}
