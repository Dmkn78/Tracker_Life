import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { CalendarClient } from "./CalendarClient";

export default async function CalendarPage() {
  await requireUser();
  return (
    <AppShell>
      <CalendarClient today={toDateKey()} />
    </AppShell>
  );
}
