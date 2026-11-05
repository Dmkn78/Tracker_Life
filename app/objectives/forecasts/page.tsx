import { AppShell } from "@/components/AppShell";
import { parseObjectivesData } from "@/features/objectives/api/objectivesApi";
import { requireUser } from "@/lib/auth";
import { ObjectivesClient } from "@/features/objectives/components/ObjectivesClient";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";

export default async function ObjectiveForecastsPage() {
  await requireUser();
  const data = await requestInternalApiJson("/api/objectives", parseObjectivesData);

  return (
    <AppShell wide>
      <ObjectivesClient initialData={data} />
    </AppShell>
  );
}
