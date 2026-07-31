import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { getObjectivesData } from "@/lib/objectives";
import { ObjectivesClient } from "./ObjectivesClient";

export default async function ObjectivesPage() {
  const user = await requireUser();
  const data = await getObjectivesData(user.id);

  return (
    <AppShell wide>
      <ObjectivesClient initialData={data} />
    </AppShell>
  );
}
