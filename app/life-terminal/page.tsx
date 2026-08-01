import { AppShell } from "@/components/AppShell";
import { parseLifeTerminalData } from "@/features/life-terminal/api/lifeTerminalApi";
import { LifeTerminalClient } from "@/features/life-terminal/components/LifeTerminalClient";
import { requireUser } from "@/lib/auth";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";

export default async function LifeTerminalPage() {
  await requireUser();
  const data = await requestInternalApiJson(
    "/api/life-terminal",
    parseLifeTerminalData
  );

  return (
    <AppShell wide>
      <LifeTerminalClient data={data} />
    </AppShell>
  );
}
