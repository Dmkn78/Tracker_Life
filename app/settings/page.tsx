import { AppShell } from "@/components/AppShell";
import { WeeklyExportButton } from "@/components/WeeklyExportButton";
import { parseSettingsResponse } from "@/features/settings/api/settingsApi";
import { isUsingDevAccessKey, requireUser } from "@/lib/auth";
import { SettingsClient } from "@/features/settings/components/SettingsClient";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";

export default async function SettingsPage() {
  await requireUser();
  const settings = await requestInternalApiJson("/api/settings", parseSettingsResponse);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">Local control</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-50">Settings</h1>
        </div>
        <WeeklyExportButton />
      </div>

      <SettingsClient
        initialCalorieTarget={settings.calorieTarget}
        initialSleepDelay={settings.defaultSleepDelayMin}
        usingDevAccessKey={isUsingDevAccessKey()}
      />
    </AppShell>
  );
}
