import { AppShell } from "@/components/AppShell";
import { DailyLogDatePicker, type DayLogStatus } from "@/components/DailyLogDatePicker";
import { DailyLogForm } from "@/components/DailyLogForm";
import { requireUser } from "@/lib/auth";
import { addDays, parseDateKey, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

function normalizeDateParam(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDateKey();
}

function monthBounds(dateKey: string) {
  const selected = parseDateKey(dateKey);
  const first = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1));
  const next = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 1));
  return {
    from: addDays(first.toISOString().slice(0, 10), -7),
    to: addDays(next.toISOString().slice(0, 10), 7)
  };
}

export default async function DailyLogPage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const date = normalizeDateParam(params?.date);
  const { from, to } = monthBounds(date);
  const monthLogs = await prisma.dailyLog.findMany({
    where: {
      userId: user.id,
      date: { gte: parseDateKey(from), lt: parseDateKey(to) }
    },
    select: { date: true, status: true }
  });
  const statuses: Record<string, DayLogStatus> = Object.fromEntries(
    monthLogs.map((log) => [log.date.toISOString().slice(0, 10), log.status.toLowerCase() as DayLogStatus])
  );

  return (
    <AppShell>
      <DailyLogDatePicker selectedDate={date} statuses={statuses} />
      <DailyLogForm selectedDate={date} defaultSleepDelayMin={user.defaultSleepDelayMin} calorieTarget={user.calorieTarget} />
    </AppShell>
  );
}
