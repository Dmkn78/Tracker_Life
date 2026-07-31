import Link from "next/link";
import { Download } from "lucide-react";
import { PrimaryButton } from "@/components/ui";
import { getIsoWeekId } from "@/lib/dates";

export function WeeklyExportButton({ weekId = getIsoWeekId() }: { weekId?: string }) {
  return (
    <Link href={`/api/reports/week?week_id=${weekId}`} target="_blank">
      <PrimaryButton>
        <Download className="h-4 w-4" />
        Export current week JSON
      </PrimaryButton>
    </Link>
  );
}
