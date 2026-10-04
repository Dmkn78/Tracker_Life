import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { WebsiteTodoClient } from "@/features/todo/components/WebsiteTodoClient";

export default async function TodoPage({ searchParams }: { searchParams: Promise<{ create?: string }> }) {
  const createToday = (await searchParams).create === "today";
  await requireUser(createToday ? "/todo?create=today" : undefined);
  return (
    <AppShell>
      <WebsiteTodoClient today={toDateKey()} createToday={createToday} />
    </AppShell>
  );
}
