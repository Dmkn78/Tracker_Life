import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { getHabitTrackerData } from "@/lib/habits";
import { HabitsClient } from "./HabitsClient";

export default async function HabitsPage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const date = params?.date ?? toDateKey();
  const data = await getHabitTrackerData(user.id, date);

  return (
    <AppShell wide>
      <HabitsClient initialData={data} />
    </AppShell>
  );
}
