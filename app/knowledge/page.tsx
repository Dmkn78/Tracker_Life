import { AppShell } from "@/components/AppShell";
import { KnowledgeView } from "@/features/knowledge/components/KnowledgeView";
import { requireUser } from "@/lib/auth";

export default async function KnowledgePage() {
  await requireUser();
  return (
    <AppShell>
      <KnowledgeView />
    </AppShell>
  );
}
