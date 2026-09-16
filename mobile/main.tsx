import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { AppearanceProvider } from "@/features/interface/components/AppearanceProvider";
import { LocaleProvider } from "@/features/interface/localization/LocaleProvider";
import { MobileApp } from "./MobileApp";
import "../app/globals.css";
import "./mobile.css";

if (!localStorage.getItem("life-regime:locale")) localStorage.setItem("life-regime:locale", "fr");
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="data-theme" defaultTheme="cream" enableSystem={false}>
    <AppearanceProvider><LocaleProvider><MobileApp /></LocaleProvider></AppearanceProvider>
  </ThemeProvider>
);
