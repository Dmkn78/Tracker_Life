"use client";

import { CalendarPageClient } from "@/features/calendar/components/CalendarPageClient";

export function CalendarClient({ today }: { today: string }) {
  return <CalendarPageClient today={today} />;
}
