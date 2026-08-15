"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { PrimaryButton } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { getIsoWeekId } from "@/lib/dates";

export function WeeklyExportButton({ weekId = getIsoWeekId() }: { weekId?: string }) {
  const { translate } = useLocale();

  return (
    <Link href={`/api/reports/week?week_id=${weekId}`} target="_blank">
      <PrimaryButton>
        <Download className="h-4 w-4" />
        {translate("reports.exportCurrentWeek")}
      </PrimaryButton>
    </Link>
  );
}
