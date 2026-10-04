import React, { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { MINIMUM_MOBILE_NATIVE_BUILD } from "./nativeCompatibility";
import { createRoot } from "react-dom/client";
import { AppThemeProvider } from "@/features/interface/components/AppThemeProvider";
import { AppearanceProvider } from "@/features/interface/components/AppearanceProvider";
import { LocaleProvider } from "@/features/interface/localization/LocaleProvider";
import { MobileApp } from "./MobileApp";
import { acknowledgeMobileReady, restoreMobileConnection, useBundledInterface } from "./mobileShell";
import "../app/globals.css";
import "./mobile.css";

function PhoneApplication() {
  useEffect(() => { void acknowledgeMobileReady().catch(() => undefined); }, []);
  return <AppThemeProvider><AppearanceProvider><LocaleProvider><MobileApp /></LocaleProvider></AppearanceProvider></AppThemeProvider>;
}

async function start(): Promise<void> {
  if (!localStorage.getItem("life-regime:locale")) localStorage.setItem("life-regime:locale", "fr");
  try { await restoreMobileConnection(); } catch { /* Existing browser preferences still allow connection and settings. */ }
  if (Capacitor.isNativePlatform()) {
    const installed = await App.getInfo();
    if (Number(installed.build) < MINIMUM_MOBILE_NATIVE_BUILD) { await useBundledInterface(); return; }
  }
  createRoot(document.getElementById("root")!).render(<PhoneApplication />);
}
void start();
