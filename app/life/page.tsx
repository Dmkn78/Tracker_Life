import { AppShell } from "@/components/AppShell";
import { parseLifeTerminalData } from "@/features/life-terminal/api/lifeTerminalApi";
import { requireUser } from "@/lib/auth";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";
import { LifeDashboardContent } from "@/features/life-terminal/components/LifeDashboardContent";

export default async function LifeDashboardPage() {
  await requireUser();
  const data = await requestInternalApiJson(
    "/api/life-terminal",
    parseLifeTerminalData
  );
  return <AppShell><LifeDashboardContent data={data} /></AppShell>;
}
