"use client";

import { CalendarPlus } from "lucide-react";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { CalendarWorkspace } from "@/features/calendar/components/CalendarWorkspace";

export function CalendarPageClient({ today }: { today: string }) {
  const { translate } = useLocale();
  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">{translate("calendar.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{translate("calendar.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">{translate("calendar.description")}</p>
        </div>
        <div className="hidden items-center gap-2 text-sm text-muted sm:flex">
          <CalendarPlus className="h-4 w-4 text-accent" />
          {translate("calendar.selectHint")}
        </div>
      </header>
      <CalendarWorkspace today={today} variant="page" />
    </div>
  );
}
