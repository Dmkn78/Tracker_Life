import { AppShell } from "@/components/AppShell";
import { WeekBoardView } from "@/features/week/components/WeekBoardView";
import { requireUser } from "@/lib/auth";

export default async function WeekPage() {
  await requireUser();
  return (
    <AppShell wide>
      <WeekBoardView />
    </AppShell>
  );
}
