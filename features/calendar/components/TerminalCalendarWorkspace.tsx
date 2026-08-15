"use client";

import { CalendarPlus } from "lucide-react";
import { CalendarWorkspace } from "@/features/calendar/components/CalendarWorkspace";
import type { CalendarEvent } from "@/features/calendar/domain/calendarEvent";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { TerminalPanel } from "@/features/life-terminal/components/TerminalPanel";

export function TerminalCalendarWorkspace({
  today,
  initialEvents
}: {
  today: string;
  initialEvents: CalendarEvent[];
}) {
  const { translate } = useLocale();
  return (
    <TerminalPanel
      title={translate("calendar.terminalTitle")}
      label={translate("calendar.externalConstraints")}
      action={<CalendarPlus className="h-4 w-4 text-accent" />}
    >
      <CalendarWorkspace
        today={today}
        variant="terminal"
        initialEvents={initialEvents}
        availableLayerIds={["events"]}
      />
    </TerminalPanel>
  );
}
