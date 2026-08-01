import { AppShell } from "@/components/AppShell";
import { parseTimeAllocationData } from "@/features/time-allocation/api/timeAllocationApi";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { TimeAllocationClient } from "@/features/time-allocation/components/TimeAllocationClient";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";

export default async function TimeAllocationPage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const date = params?.date ?? toDateKey();
  const data = await requestInternalApiJson(
    `/api/time-allocation?date=${encodeURIComponent(date)}`,
    parseTimeAllocationData
  );

  return (
    <AppShell wide>
      <TimeAllocationClient initialData={data} />
    </AppShell>
  );
}
