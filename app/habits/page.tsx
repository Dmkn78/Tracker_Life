import { AppShell } from "@/components/AppShell";
import { parseHabitTrackerData } from "@/features/habits/api/habitsApi";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { HabitsClient } from "@/features/habits/components/HabitsClient";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";

export default async function HabitsPage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const date = params?.date ?? toDateKey();
  const data = await requestInternalApiJson(
    `/api/habits?date=${encodeURIComponent(date)}`,
    parseHabitTrackerData
  );

  return (
    <AppShell wide>
      <HabitsClient initialData={data} />
    </AppShell>
  );
}
