"use client";

import { AppShell } from "@/components/AppShell";
import { WeeklyExportButton } from "@/components/WeeklyExportButton";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { SettingsClient } from "./SettingsClient";

type SettingsPageContentProps = {
  initialCalorieTarget: number;
  initialSleepDelay: number;
  usingDevAccessKey: boolean;
};

export function SettingsPageContent(props: SettingsPageContentProps) {
  const { translate } = useLocale();

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">{translate("settings.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{translate("settings.title")}</h1>
        </div>
        <WeeklyExportButton />
      </div>
      <SettingsClient {...props} />
    </AppShell>
  );
}
