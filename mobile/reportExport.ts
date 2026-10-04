import { Capacitor, registerPlugin } from "@capacitor/core";
import { expectJsonObject, requestJson } from "@/lib/http/apiClient";
import { getIsoWeekId } from "@/lib/dates";

const ReportExport = registerPlugin<{ share: (options: { weekId: string; json: string }) => Promise<void> }>("ReportExport");

export async function exportMobileReport(href: string): Promise<void> {
  const url = new URL(href, "https://mobile.invalid");
  const weekId = url.searchParams.get("week_id") ?? getIsoWeekId();
  if (url.pathname !== "/api/reports/week" || !weekId || !/^\d{4}-W\d{2}$/.test(weekId)) throw new Error("Semaine d’export invalide.");
  const report = await requestJson(`/api/reports/week?week_id=${weekId}`, expectJsonObject);
  const json = JSON.stringify(report, null, 2);
  if (Capacitor.isNativePlatform()) {
    await ReportExport.share({ weekId, json });
    return;
  }
  const blobUrl = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `Life-Regime-${weekId}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
