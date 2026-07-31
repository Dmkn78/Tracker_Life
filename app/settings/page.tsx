import { AppShell } from "@/components/AppShell";
import { WeeklyExportButton } from "@/components/WeeklyExportButton";
import { isUsingDevAccessKey, requireUser } from "@/lib/auth";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const user = await requireUser();

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
        initialCalorieTarget={user.calorieTarget}
        initialSleepDelay={user.defaultSleepDelayMin}
        usingDevAccessKey={isUsingDevAccessKey()}
      />
    </AppShell>
  );
}
