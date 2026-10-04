"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { APPEARANCE_PREFERENCES, DEFAULT_APPEARANCE } from "../domain/appearance";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme={DEFAULT_APPEARANCE} themes={[...APPEARANCE_PREFERENCES]} enableColorScheme={false} enableSystem={false}>{children}</ThemeProvider>;
}
