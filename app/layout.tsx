import type { Metadata } from "next";
import { AppThemeProvider } from "@/features/interface/components/AppThemeProvider";
import { AppearanceProvider } from "@/features/interface/components/AppearanceProvider";
import { LocaleProvider } from "@/features/interface/localization/LocaleProvider";
import { AndroidWebsiteBridge } from "@/features/android/components/AndroidWebsiteBridge";
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
        <AppThemeProvider>
          <LocaleProvider>
            <AppearanceProvider><AndroidWebsiteBridge />{children}</AppearanceProvider>
          </LocaleProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
