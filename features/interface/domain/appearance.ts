export const APPEARANCE_PREFERENCES = [
  "dark",
  "light",
  "cream",
  "sunlight",
  "low-light",
  "warm",
  "adaptive"
] as const;

export const MANUAL_PALETTES = [
  "dark",
  "light",
  "cream",
  "sunlight",
  "low-light",
  "warm"
] as const;

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type ManualPalette = (typeof MANUAL_PALETTES)[number];
export type AdaptivePaletteSource = "ambient-light" | "media-preferences" | "fallback";

export type AdaptivePaletteResult = {
  palette: ManualPalette;
  source: AdaptivePaletteSource;
};

export type AdaptivePaletteInput = {
  ambientLux: number | null;
  hasMediaPreferences: boolean;
  prefersDark: boolean;
  prefersMoreContrast: boolean;
};

export const DEFAULT_APPEARANCE: AppearancePreference = "dark";
export const DEFAULT_ADAPTIVE_PALETTE: ManualPalette = "dark";
export const AMBIENT_LIGHT_SENSOR_FREQUENCY_HZ = 1;
export const LOW_LIGHT_MAX_LUX = 50;
export const WARM_LIGHT_MAX_LUX = 250;
export const SUNLIGHT_MIN_LUX = 10_000;

export function isAppearancePreference(value: string | undefined): value is AppearancePreference {
  return APPEARANCE_PREFERENCES.some((appearance) => appearance === value);
}

export function resolveAdaptivePalette(input: AdaptivePaletteInput): AdaptivePaletteResult {
  if (input.ambientLux !== null && Number.isFinite(input.ambientLux)) {
    return {
      palette: selectPaletteForAmbientLight(input.ambientLux),
      source: "ambient-light"
    };
  }

  if (input.hasMediaPreferences) {
    return {
      palette: selectPaletteForMediaPreferences(input),
      source: "media-preferences"
    };
  }

  return {
    palette: DEFAULT_ADAPTIVE_PALETTE,
    source: "fallback"
  };
}

function selectPaletteForAmbientLight(ambientLux: number): ManualPalette {
  if (ambientLux >= SUNLIGHT_MIN_LUX) return "sunlight";
  if (ambientLux <= LOW_LIGHT_MAX_LUX) return "low-light";
  if (ambientLux <= WARM_LIGHT_MAX_LUX) return "warm";
  return "light";
}

function selectPaletteForMediaPreferences({
  prefersDark,
  prefersMoreContrast
}: Pick<AdaptivePaletteInput, "prefersDark" | "prefersMoreContrast">): ManualPalette {
  if (prefersMoreContrast) return "sunlight";
  return prefersDark ? "warm" : "light";
}
