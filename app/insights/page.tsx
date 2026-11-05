import { AppShell } from "@/components/AppShell";
import { InsightsView } from "@/features/insights/components/InsightsView";
import { requireUser } from "@/lib/auth";

export default async function InsightsPage() {
  await requireUser();
  return (
    <AppShell>
      <InsightsView />
    </AppShell>
  );
}
