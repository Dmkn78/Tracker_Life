import { useEffect, useState } from "react";
import { FieldLabel, SecondaryButton, TextInput } from "@/components/ui";
import { DailyLogForm } from "@/features/daily-log/components/DailyLogForm";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { parseSettingsResponse } from "@/features/settings/api/settingsApi";
import type { TrackingSettings } from "@/features/settings/domain/settings";
import { toDateKey } from "@/lib/dates";
import { requestJson } from "@/lib/http/apiClient";

export default function MobileDailyLog({ server }: { server: string }) {
  const { locale } = useLocale();
  const [date, setDate] = useState(toDateKey());
  const [settings, setSettings] = useState<TrackingSettings>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const fr = locale === "fr";

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void requestJson("/api/settings", parseSettingsResponse, { signal: controller.signal })
      .then((loadedSettings) => { if (!controller.signal.aborted) setSettings(loadedSettings); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load log settings.");
      });
    return () => controller.abort();
  }, [attempt]);

  return <div className="space-y-4">
    <FieldLabel>{fr ? "Date du journal" : "Log date"}<TextInput type="date" value={date}
      onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></FieldLabel>
    {error ? <div><p role="alert" className="text-sm text-risk">{error}</p><SecondaryButton onClick={() => setAttempt((current) => current + 1)}>{fr ? "Réessayer" : "Retry"}</SecondaryButton></div> : null}
    {settings ? <DailyLogForm key={date} selectedDate={date} draftStorageKey={`life-regime:daily-log:${server}:${date}`} defaultSleepDelayMin={settings.defaultSleepDelayMin} calorieTarget={settings.calorieTarget} />
      : !error ? <p role="status" className="text-sm text-muted">{fr ? "Chargement du journal…" : "Loading your log…"}</p> : null}
  </div>;
}
