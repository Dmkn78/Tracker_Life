import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { ThinkingNotesClient } from "@/features/thinking-notes/components/ThinkingNotesClient";

export default async function ThinkingPage() {
  await requireUser();
  return (
    <AppShell>
      <ThinkingNotesClient today={toDateKey()} />
    </AppShell>
  );
}
