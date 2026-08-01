"use client";

import { KeyRound, Lock, Moon } from "lucide-react";
import { useState } from "react";
import { FieldLabel, Panel, SelectInput, TextInput } from "@/components/ui";
import { updateTrackingSettings } from "@/features/settings/api/settingsApi";
import type { TrackingSettingsPatch } from "@/features/settings/domain/settings";
import { ApiError } from "@/lib/http/apiClient";
import { LogoutButton } from "./LogoutButton";

export function SettingsClient({
  initialCalorieTarget,
  initialSleepDelay,
  usingDevAccessKey
}: {
  initialCalorieTarget: number;
  initialSleepDelay: number;
  usingDevAccessKey: boolean;
}) {
  const [calorieTarget, setCalorieTarget] = useState(initialCalorieTarget);
  const [defaultSleepDelayMin, setDefaultSleepDelayMin] = useState(initialSleepDelay);
  const [saved, setSaved] = useState("Saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(patch: Partial<TrackingSettingsPatch>) {
    setSaved("Saving...");
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
      setSaveError(readApiErrorMessage(error, "Unable to save tracking settings."));
    } finally {
      setSaved(wasSaved ? "Saved" : "Save failed");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-accent">Defaults</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Tracking settings</h2>
          </div>
          <span className="text-sm font-semibold text-slate-400">{saved}</span>
        </div>
        <div className="space-y-4">
          {saveError ? (
            <p role="alert" className="rounded-xl bg-risk/10 px-3 py-2 text-sm text-risk">
              {saveError}
            </p>
          ) : null}
          <div>
            <FieldLabel>Calorie target</FieldLabel>
            <TextInput
              type="number"
              value={calorieTarget}
              onChange={(event) => setCalorieTarget(Number(event.target.value))}
              onBlur={() => save({ calorieTarget })}
              className="mt-2"
            />
          </div>
          <div>
            <FieldLabel>Default sleep delay</FieldLabel>
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
                  {minutes} min
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
            <h2 className="text-lg font-semibold text-slate-50">Access key</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Authentication uses a signed httpOnly cookie. Password rotation UI is a placeholder for now.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-shell px-3 py-2 text-sm text-slate-400">
              <Lock className="h-4 w-4" />
              Access key configured in <code>.env</code>
            </div>
            {usingDevAccessKey ? (
              <p className="mt-3 rounded-md border border-warn/45 bg-warn/10 p-3 text-sm font-medium text-warn">
                Development fallback key is active.
              </p>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-violet/15 text-violet">
            <Moon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Theme</h2>
            <p className="mt-2 text-sm text-slate-400">Dark mode is locked for this MVP.</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold text-slate-50">Session</h2>
        <p className="mt-2 text-sm text-slate-400">Clear the signed cookie and return to the access-key screen.</p>
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
