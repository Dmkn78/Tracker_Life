import { AppShell } from "@/components/AppShell";
import { parseTimeAllocationData } from "@/features/time-allocation/api/timeAllocationApi";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { TimeAllocationClient } from "@/features/time-allocation/components/TimeAllocationClient";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";
import {
  canonicalAllocationAnchor,
  isTimeAllocationPeriod
} from "@/features/time-allocation/domain/allocationPeriod";

export default async function TimeAllocationPage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string; period?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const hasExplicitSelection = params?.date !== undefined || params?.period !== undefined;
  const period = isTimeAllocationPeriod(params?.period) ? params.period : "day";
  const date = canonicalAllocationAnchor(period, params?.date ?? toDateKey());
  const data = await requestInternalApiJson(
    `/api/time-allocation?period=${period}&date=${encodeURIComponent(date)}`,
    parseTimeAllocationData
  );

  return (
    <AppShell wide>
      <TimeAllocationClient initialData={data} hasExplicitSelection={hasExplicitSelection} />
    </AppShell>
  );
}
