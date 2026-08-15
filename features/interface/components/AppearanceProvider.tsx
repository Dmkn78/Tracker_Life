"use client";

import { useTheme } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  AMBIENT_LIGHT_SENSOR_FREQUENCY_HZ,
  DEFAULT_ADAPTIVE_PALETTE,
  DEFAULT_APPEARANCE,
  isAppearancePreference,
  resolveAdaptivePalette,
  type AdaptivePaletteResult,
  type AppearancePreference
} from "../domain/appearance";

type AppearanceContextValue = {
  appearance: AppearancePreference;
  adaptiveResult: AdaptivePaletteResult;
  setAppearance: (appearance: AppearancePreference) => void;
};

type AmbientLightSensorLike = EventTarget & {
  readonly illuminance: number | null;
  start: () => void;
  stop: () => void;
};

type AmbientLightSensorConstructor = new (options?: { frequency?: number }) => AmbientLightSensorLike;
type AmbientLightWindow = Window & { AmbientLightSensor?: AmbientLightSensorConstructor };

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const MORE_CONTRAST_QUERY = "(prefers-contrast: more)";
const AppearanceContext = createContext<AppearanceContextValue | null>(null);
const INITIAL_ADAPTIVE_RESULT: AdaptivePaletteResult = {
  palette: DEFAULT_ADAPTIVE_PALETTE,
  source: "fallback"
};

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [adaptiveResult, setAdaptiveResult] = useState(INITIAL_ADAPTIVE_RESULT);
  const appearance = isMounted && isAppearancePreference(theme) ? theme : DEFAULT_APPEARANCE;
  const updateAdaptiveResult = useCallback((nextResult: AdaptivePaletteResult) => {
    setAdaptiveResult((currentResult) => {
      const hasChanged = currentResult.palette !== nextResult.palette
        || currentResult.source !== nextResult.source;
      return hasChanged ? nextResult : currentResult;
    });
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (appearance !== "adaptive") {
      document.documentElement.removeAttribute("data-adaptive-palette");
      return;
    }

    const cleanupAdaptivePalette = observeAdaptivePalette(updateAdaptiveResult);
    return cleanupAdaptivePalette;
  }, [appearance, updateAdaptiveResult]);

  useEffect(() => {
    if (appearance === "adaptive") {
      document.documentElement.dataset.adaptivePalette = adaptiveResult.palette;
    }
  }, [adaptiveResult.palette, appearance]);

  const setAppearance = useCallback((appearancePreference: AppearancePreference) => {
    setTheme(appearancePreference);
  }, [setTheme]);
  const contextValue = useMemo<AppearanceContextValue>(() => ({
    appearance,
    adaptiveResult,
    setAppearance
  }), [adaptiveResult, appearance, setAppearance]);

  return (
    <AppearanceContext.Provider value={contextValue}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used inside AppearanceProvider");
  return context;
}

function observeAdaptivePalette(
  updateResult: (result: AdaptivePaletteResult) => void
): () => void {
  if (typeof window.matchMedia !== "function") {
    updateResult(INITIAL_ADAPTIVE_RESULT);
    return () => document.documentElement.removeAttribute("data-adaptive-palette");
  }

  const darkScheme = window.matchMedia(DARK_SCHEME_QUERY);
  const moreContrast = window.matchMedia(MORE_CONTRAST_QUERY);
  let ambientLux: number | null = null;

  const updateFromAvailableCapabilities = () => {
    updateResult(resolveAdaptivePalette({
      ambientLux,
      hasMediaPreferences: true,
      prefersDark: darkScheme.matches,
      prefersMoreContrast: moreContrast.matches
    }));
  };

  darkScheme.addEventListener("change", updateFromAvailableCapabilities);
  moreContrast.addEventListener("change", updateFromAvailableCapabilities);
  updateFromAvailableCapabilities();

  const stopAmbientLightSensor = startAmbientLightSensor((illuminance) => {
    ambientLux = illuminance;
    updateFromAvailableCapabilities();
  });

  return () => {
    darkScheme.removeEventListener("change", updateFromAvailableCapabilities);
    moreContrast.removeEventListener("change", updateFromAvailableCapabilities);
    stopAmbientLightSensor?.();
    document.documentElement.removeAttribute("data-adaptive-palette");
  };
}

function startAmbientLightSensor(
  updateIlluminance: (illuminance: number | null) => void
): (() => void) | null {
  const AmbientLightSensor = (window as AmbientLightWindow).AmbientLightSensor;
  if (!AmbientLightSensor) return null;

  try {
    const sensor = new AmbientLightSensor({ frequency: AMBIENT_LIGHT_SENSOR_FREQUENCY_HZ });
    const readIlluminance = () => updateIlluminance(sensor.illuminance);
    const handleSensorError = () => updateIlluminance(null);

    sensor.addEventListener("reading", readIlluminance);
    sensor.addEventListener("error", handleSensorError);
    sensor.start();

    return () => {
      sensor.removeEventListener("reading", readIlluminance);
      sensor.removeEventListener("error", handleSensorError);
      sensor.stop();
    };
  } catch {
    return null;
  }
}
