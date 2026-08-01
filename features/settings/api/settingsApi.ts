import {
  expectJsonObject,
  expectNumber,
  expectString,
  requestJson
} from "@/lib/http/apiClient";
import type {
  TrackingSettings,
  TrackingSettingsPatch
} from "../domain/settings";

export function updateTrackingSettings(
  input: TrackingSettingsPatch
): Promise<TrackingSettings> {
  return requestJson("/api/settings", parseSettingsResponse, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function parseSettingsResponse(payload: unknown): TrackingSettings {
  const response = expectJsonObject(payload, "settings response");
  const settings = expectJsonObject(response.settings, "settings response.settings");
  return {
    calorieTarget: expectNumber(settings.calorieTarget, "settings response.settings.calorieTarget"),
    defaultSleepDelayMin: expectNumber(
      settings.defaultSleepDelayMin,
      "settings response.settings.defaultSleepDelayMin"
    ),
    theme: expectString(settings.theme, "settings response.settings.theme")
  };
}
