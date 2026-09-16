"use client";

import { MonitorCog } from "lucide-react";
import { useId } from "react";
import { SelectInput } from "@/components/ui";
import {
  APPEARANCE_PREFERENCES,
  isAppearancePreference,
  type AdaptivePaletteSource,
  type AppearancePreference
} from "../domain/appearance";
import { useLocale } from "../localization/LocaleProvider";
import type { TranslationKey } from "../localization/messages";
import { useAppearance } from "./AppearanceProvider";

const appearanceLabelKeys: Record<AppearancePreference, TranslationKey> = {
  dark: "appearance.dark",
  light: "appearance.light",
  cream: "appearance.cream",
  sunlight: "appearance.sunlight",
  "low-light": "appearance.lowLight",
  warm: "appearance.warm",
  adaptive: "appearance.adaptive"
};

const appearanceDescriptionKeys: Record<AppearancePreference, TranslationKey> = {
  dark: "appearance.darkDescription",
  light: "appearance.lightDescription",
  cream: "appearance.creamDescription",
  sunlight: "appearance.sunlightDescription",
  "low-light": "appearance.lowLightDescription",
  warm: "appearance.warmDescription",
  adaptive: "appearance.adaptiveDescription"
};

const adaptiveSourceKeys: Record<AdaptivePaletteSource, TranslationKey> = {
  "ambient-light": "appearance.sourceAmbient",
  "media-preferences": "appearance.sourceMedia",
  fallback: "appearance.sourceFallback"
};

export function AppearanceControl({ compact = false }: { compact?: boolean }) {
  const { appearance, adaptiveResult, setAppearance } = useAppearance();
  const { translate } = useLocale();
  const selectId = useId();

  if (compact) {
    const nextAppearance = getNextAppearance(appearance);
    return (
      <button
        type="button"
        onClick={() => setAppearance(nextAppearance)}
        className="focus-ring inline-flex h-11 items-center justify-center rounded-2xl bg-panel2/60 px-3 text-muted ring-1 ring-line transition hover:bg-panel2 hover:text-ink"
        aria-label={`${translate("appearance.label")}: ${translate(appearanceLabelKeys[appearance])}`}
        title={`${translate("appearance.label")}: ${translate(appearanceLabelKeys[appearance])}`}
      >
        <MonitorCog className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="rounded-[20px] bg-panel2/70 p-3 ring-1 ring-line">
      <label className="text-xs font-medium uppercase text-muted" htmlFor={selectId}>
        {translate("appearance.label")}
      </label>
      <SelectInput
        id={selectId}
        value={appearance}
        onChange={(event) => {
          if (isAppearancePreference(event.target.value)) setAppearance(event.target.value);
        }}
        className="mt-2"
      >
        {APPEARANCE_PREFERENCES.map((preference) => (
          <option key={preference} value={preference}>
            {translate(appearanceLabelKeys[preference])}
          </option>
        ))}
      </SelectInput>
      {appearance === "adaptive" ? (
        <p className="mt-2 text-xs leading-5 text-muted">
          {translate("appearance.effectivePalette", {
            palette: translate(appearanceLabelKeys[adaptiveResult.palette])
          })} · {translate(adaptiveSourceKeys[adaptiveResult.source])}
        </p>
      ) : null}
    </div>
  );
}

export function AppearanceSettingsControl() {
  const { appearance, adaptiveResult, setAppearance } = useAppearance();
  const { translate } = useLocale();

  return (
    <div className="space-y-3">
      <SelectInput
        aria-label={translate("appearance.label")}
        value={appearance}
        onChange={(event) => {
          if (isAppearancePreference(event.target.value)) setAppearance(event.target.value);
        }}
      >
        {APPEARANCE_PREFERENCES.map((preference) => (
          <option key={preference} value={preference}>
            {translate(appearanceLabelKeys[preference])}
          </option>
        ))}
      </SelectInput>
      <p className="text-sm leading-6 text-muted">{translate(appearanceDescriptionKeys[appearance])}</p>
      {appearance === "adaptive" ? (
        <p className="rounded-2xl bg-panel2 px-3 py-2 text-xs leading-5 text-muted ring-1 ring-line">
          {translate("appearance.effectivePalette", {
            palette: translate(appearanceLabelKeys[adaptiveResult.palette])
          })} · {translate(adaptiveSourceKeys[adaptiveResult.source])}
        </p>
      ) : null}
    </div>
  );
}

function getNextAppearance(appearance: AppearancePreference): AppearancePreference {
  const currentIndex = APPEARANCE_PREFERENCES.indexOf(appearance);
  return APPEARANCE_PREFERENCES[(currentIndex + 1) % APPEARANCE_PREFERENCES.length];
}
