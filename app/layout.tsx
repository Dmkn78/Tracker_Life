import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { AppearanceProvider } from "@/features/interface/components/AppearanceProvider";
import { APPEARANCE_PREFERENCES, DEFAULT_APPEARANCE } from "@/features/interface/domain/appearance";
import { LocaleProvider } from "@/features/interface/localization/LocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Regime Tracker",
  description: "Low-friction daily tracking, tasks, calendar context, and weekly JSON exports."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme={DEFAULT_APPEARANCE}
          enableColorScheme={false}
          enableSystem={false}
          themes={[...APPEARANCE_PREFERENCES]}
        >
          <LocaleProvider>
            <AppearanceProvider>{children}</AppearanceProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
