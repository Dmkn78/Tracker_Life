import { AppShell } from "@/components/AppShell";
import { parseHistoryData } from "@/features/history/api/historyApi";
import { normalizeHistoryFilter } from "@/features/history/domain/history";
import { requireUser } from "@/lib/auth";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";
import { HistoryContent } from "@/features/history/components/HistoryContent";

export default async function HistoryPage({
  searchParams
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const filter = normalizeHistoryFilter(params?.filter);
  const data = await requestInternalApiJson(
    `/api/history?filter=${encodeURIComponent(filter)}`,
    parseHistoryData
  );
  return <AppShell><HistoryContent data={data} /></AppShell>;
}
