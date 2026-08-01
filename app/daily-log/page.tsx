import { AppShell } from "@/components/AppShell";
import { parseDailyLogStatuses } from "@/features/daily-log/api/dailyLogApi";
import { DailyLogDatePicker } from "@/features/daily-log/components/DailyLogDatePicker";
import { DailyLogForm } from "@/features/daily-log/components/DailyLogForm";
import { parseSettingsResponse } from "@/features/settings/api/settingsApi";
import { requireUser } from "@/lib/auth";
import { addDays, parseDateKey, toDateKey } from "@/lib/dates";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";

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
  await requireUser();
  const params = await searchParams;
  const date = normalizeDateParam(params?.date);
  const { from, to } = monthBounds(date);
  const [statuses, settings] = await Promise.all([
    requestInternalApiJson(
      `/api/daily-log/statuses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      parseDailyLogStatuses
    ),
    requestInternalApiJson("/api/settings", parseSettingsResponse)
  ]);

  return (
    <AppShell>
      <DailyLogDatePicker selectedDate={date} statuses={statuses} />
      <DailyLogForm
        selectedDate={date}
        defaultSleepDelayMin={settings.defaultSleepDelayMin}
        calorieTarget={settings.calorieTarget}
      />
    </AppShell>
  );
}
