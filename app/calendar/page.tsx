import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { CalendarPageClient } from "@/features/calendar/components/CalendarPageClient";

export default async function CalendarPage() {
  await requireUser();
  return (
    <AppShell>
      <CalendarPageClient today={toDateKey()} />
    </AppShell>
  );
}
