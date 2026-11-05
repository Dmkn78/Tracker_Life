import { AppShell } from "@/components/AppShell";
import { PlanningBoardView } from "@/features/planning/components/PlanningBoardView";
import { requireUser } from "@/lib/auth";

export default async function PlanningPage() {
  await requireUser();
  return (
    <AppShell wide>
      <PlanningBoardView />
    </AppShell>
  );
}
