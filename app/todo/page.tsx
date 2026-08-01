import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { TodoClient } from "@/features/todo/components/TodoClient";

export default async function TodoPage() {
  await requireUser();
  return (
    <AppShell>
      <TodoClient today={toDateKey()} />
    </AppShell>
  );
}
