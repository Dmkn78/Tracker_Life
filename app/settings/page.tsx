import { parseSettingsResponse } from "@/features/settings/api/settingsApi";
import { SettingsPageContent } from "@/features/settings/components/SettingsPageContent";
import { isUsingDevAccessKey, requireUser } from "@/lib/auth";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";

export default async function SettingsPage() {
  await requireUser();
  const settings = await requestInternalApiJson("/api/settings", parseSettingsResponse);

  return (
    <SettingsPageContent
      initialCalorieTarget={settings.calorieTarget}
      initialSleepDelay={settings.defaultSleepDelayMin}
      usingDevAccessKey={isUsingDevAccessKey()}
    />
  );
}
