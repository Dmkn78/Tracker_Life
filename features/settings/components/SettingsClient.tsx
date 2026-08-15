"use client";

import { KeyRound, Lock, Palette } from "lucide-react";
import { useState } from "react";
import { FieldLabel, Panel, SelectInput, TextInput } from "@/components/ui";
import { AppearanceSettingsControl } from "@/features/interface/components/AppearanceControl";
import { LocaleControl } from "@/features/interface/components/LocaleControl";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { updateTrackingSettings } from "@/features/settings/api/settingsApi";
import type { TrackingSettingsPatch } from "@/features/settings/domain/settings";
import { ApiError } from "@/lib/http/apiClient";
import { LogoutButton } from "./LogoutButton";

type SaveState = "saved" | "saving" | "failed";

export function SettingsClient({
  initialCalorieTarget,
  initialSleepDelay,
  usingDevAccessKey
}: {
  initialCalorieTarget: number;
  initialSleepDelay: number;
  usingDevAccessKey: boolean;
}) {
  const { translate } = useLocale();
  const [calorieTarget, setCalorieTarget] = useState(initialCalorieTarget);
  const [defaultSleepDelayMin, setDefaultSleepDelayMin] = useState(initialSleepDelay);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(patch: Partial<TrackingSettingsPatch>): Promise<void> {
    setSaveState("saving");
    setSaveError(null);
    let wasSaved = false;
    try {
      const settings = await updateTrackingSettings({
        calorieTarget,
        defaultSleepDelayMin,
        ...patch
      });
      setCalorieTarget(settings.calorieTarget);
      setDefaultSleepDelayMin(settings.defaultSleepDelayMin);
      wasSaved = true;
    } catch (error: unknown) {
      setSaveError(readApiErrorMessage(error, translate("settings.saveError")));
    } finally {
      setSaveState(wasSaved ? "saved" : "failed");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-accent">{translate("settings.defaults")}</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{translate("settings.trackingTitle")}</h2>
          </div>
          <span className="text-sm font-semibold text-muted">
            {translate(
              saveState === "saving"
                ? "settings.saving"
                : saveState === "failed"
                  ? "settings.saveFailed"
                  : "settings.saved"
            )}
          </span>
        </div>
        <div className="space-y-4">
          {saveError ? (
            <p role="alert" className="rounded-xl bg-risk/10 px-3 py-2 text-sm text-risk">
              {saveError}
            </p>
          ) : null}
          <div>
            <FieldLabel>{translate("settings.calorieTarget")}</FieldLabel>
            <TextInput
              type="number"
              value={calorieTarget}
              onChange={(event) => setCalorieTarget(Number(event.target.value))}
              onBlur={() => save({ calorieTarget })}
              className="mt-2"
            />
          </div>
          <div>
            <FieldLabel>{translate("settings.sleepDelay")}</FieldLabel>
            <SelectInput
              value={defaultSleepDelayMin}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDefaultSleepDelayMin(value);
                save({ defaultSleepDelayMin: value });
              }}
              className="mt-2 w-full"
            >
              {[10, 20, 30, 45, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {translate("settings.minutes", { minutes })}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent/10 text-accent">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink">{translate("settings.accessKey")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{translate("settings.accessDescription")}</p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-shell px-3 py-2 text-sm text-muted">
              <Lock className="h-4 w-4" />
              {translate("settings.accessConfigured")}
            </div>
            {usingDevAccessKey ? (
              <p className="mt-3 rounded-md border border-warn/45 bg-warn/10 p-3 text-sm font-medium text-warn">
                {translate("settings.devKeyWarning")}
              </p>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-violet/15 text-violet">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">{translate("settings.appearanceTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{translate("settings.appearanceDescription")}</p>
            <div className="mt-4 space-y-4">
              <AppearanceSettingsControl />
              <LocaleControl />
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold text-ink">{translate("settings.session")}</h2>
        <p className="mt-2 text-sm text-muted">{translate("settings.sessionDescription")}</p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </Panel>
    </div>
  );
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
