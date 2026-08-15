"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  englishMessages,
  frenchMessages,
  type TranslationDictionary,
  type TranslationKey
} from "./messages";

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  translate: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
};

const DEFAULT_LOCALE: SupportedLocale = "en";
const LOCALE_STORAGE_KEY = "life-regime:locale";
const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  en: englishMessages,
  fr: frenchMessages
};
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(storedLocale)) setLocaleState(storedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((localePreference: SupportedLocale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, localePreference);
    setLocaleState(localePreference);
  }, []);

  const translate = useCallback((
    key: TranslationKey,
    replacements: Record<string, string | number> = {}
  ): string => {
    return Object.entries(replacements).reduce(
      (message, [placeholder, replacement]) => message.replaceAll(`{${placeholder}}`, String(replacement)),
      dictionaries[locale][key]
    );
  }, [locale]);
  const contextValue = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    translate
  }), [locale, setLocale, translate]);

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

export function isSupportedLocale(value: string | null): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}
