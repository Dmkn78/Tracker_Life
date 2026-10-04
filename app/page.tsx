import { AppShell } from "@/components/AppShell";
import { parseLifeTerminalData } from "@/features/life-terminal/api/lifeTerminalApi";
import { requireUser } from "@/lib/auth";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";
import { HomeContent } from "@/features/home/components/HomeContent";

export default async function HomePage() {
  await requireUser();
  const data = await requestInternalApiJson(
    "/api/life-terminal",
    parseLifeTerminalData
  );
  return <AppShell><HomeContent data={data} /></AppShell>;
}
