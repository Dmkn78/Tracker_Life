import { AppShell } from "@/components/AppShell";
import { GoalsView } from "@/features/goals/components/GoalsView";
import { requireUser } from "@/lib/auth";

export default async function GoalsPage() {
  await requireUser();
  return (
    <AppShell>
      <GoalsView />
    </AppShell>
  );
}
