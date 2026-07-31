import { AppShell } from "@/components/AppShell";
import { getLifeTerminalData } from "@/lib/lifeTerminal";
import { LifeTerminalClient } from "./LifeTerminalClient";

export default async function LifeTerminalPage() {
  const data = await getLifeTerminalData();

  return (
    <AppShell wide>
      <LifeTerminalClient data={data} />
    </AppShell>
  );
}
