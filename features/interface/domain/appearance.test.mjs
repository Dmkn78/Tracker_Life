import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdaptivePalette } from "./appearance.ts";

const NO_MEDIA_PREFERENCES = {
  hasMediaPreferences: false,
  prefersDark: false,
  prefersMoreContrast: false
};

test("selects ambient palettes at every lux boundary", () => {
  const cases = [
    { ambientLux: 50, expectedPalette: "low-light" },
    { ambientLux: 50.01, expectedPalette: "warm" },
    { ambientLux: 250, expectedPalette: "warm" },
    { ambientLux: 250.01, expectedPalette: "light" },
    { ambientLux: 9_999.99, expectedPalette: "light" },
    { ambientLux: 10_000, expectedPalette: "sunlight" }
  ];

  for (const { ambientLux, expectedPalette } of cases) {
    assert.deepEqual(
      resolveAdaptivePalette({ ambientLux, ...NO_MEDIA_PREFERENCES }),
      { palette: expectedPalette, source: "ambient-light" }
    );
  }
});

test("uses the deterministic fallback when lux and media preferences are unavailable", () => {
  assert.deepEqual(
    resolveAdaptivePalette({ ambientLux: null, ...NO_MEDIA_PREFERENCES }),
    { palette: "dark", source: "fallback" }
  );
  assert.deepEqual(
    resolveAdaptivePalette({ ambientLux: Number.NaN, ...NO_MEDIA_PREFERENCES }),
    { palette: "dark", source: "fallback" }
  );
});

test("uses system theme and contrast preferences when ambient light is unavailable", () => {
  assert.deepEqual(
    resolveAdaptivePalette({
      ambientLux: null,
      hasMediaPreferences: true,
      prefersDark: true,
      prefersMoreContrast: false
    }),
    { palette: "warm", source: "media-preferences" }
  );
  assert.deepEqual(
    resolveAdaptivePalette({
      ambientLux: Number.NaN,
      hasMediaPreferences: true,
      prefersDark: false,
      prefersMoreContrast: true
    }),
    { palette: "sunlight", source: "media-preferences" }
  );
  assert.deepEqual(
    resolveAdaptivePalette({
      ambientLux: null,
      hasMediaPreferences: true,
      prefersDark: false,
      prefersMoreContrast: false
    }),
    { palette: "light", source: "media-preferences" }
  );
});
