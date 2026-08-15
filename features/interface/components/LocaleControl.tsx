"use client";

import { Languages } from "lucide-react";
import { useId } from "react";
import { SelectInput } from "@/components/ui";
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  useLocale,
  type SupportedLocale
} from "../localization/LocaleProvider";

export function LocaleControl({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, translate } = useLocale();
  const selectId = useId();

  if (compact) {
    const nextLocale: SupportedLocale = locale === "en" ? "fr" : "en";
    return (
      <button
        type="button"
        onClick={() => setLocale(nextLocale)}
        className="focus-ring inline-flex h-11 items-center justify-center rounded-2xl bg-panel2/60 px-3 text-muted ring-1 ring-line transition hover:bg-panel2 hover:text-ink"
        aria-label={`${translate("locale.label")}: ${locale.toUpperCase()}`}
        title={`${translate("locale.label")}: ${locale.toUpperCase()}`}
      >
        <Languages className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div>
      <label className="text-xs font-medium uppercase text-muted" htmlFor={selectId}>
        {translate("locale.label")}
      </label>
      <SelectInput
        id={selectId}
        value={locale}
        onChange={(event) => {
          if (isSupportedLocale(event.target.value)) setLocale(event.target.value);
        }}
        className="mt-2"
      >
        {SUPPORTED_LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {translate(supportedLocale === "en" ? "locale.english" : "locale.french")}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}
