import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { getTimeAllocationData } from "@/lib/timeAllocation";
import { TimeAllocationClient } from "./TimeAllocationClient";

export default async function TimeAllocationPage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const date = params?.date ?? toDateKey();
  const data = await getTimeAllocationData(user.id, date);

  return (
    <AppShell wide>
      <TimeAllocationClient initialData={data} />
    </AppShell>
  );
}
