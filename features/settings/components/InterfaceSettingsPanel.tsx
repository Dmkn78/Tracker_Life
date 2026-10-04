"use client";

import { Palette } from "lucide-react";
import { Panel } from "@/components/ui";
import { AppearanceSettingsControl } from "@/features/interface/components/AppearanceControl";
import { LocaleControl } from "@/features/interface/components/LocaleControl";
import { useLocale } from "@/features/interface/localization/LocaleProvider";

export function InterfaceSettingsPanel() {
  const { translate } = useLocale();
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-violet/15 text-violet"><Palette className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-semibold text-ink">{translate("settings.appearanceTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{translate("settings.appearanceDescription")}</p>
          <div className="mt-4 space-y-4"><AppearanceSettingsControl /><LocaleControl /></div>
        </div>
      </div>
    </Panel>
  );
}
