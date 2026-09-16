import { AppShell } from "@/components/AppShell";
import { PerformanceClient } from "@/features/performance/components/PerformanceClient";
import { requireUser } from "@/lib/auth";

export default async function PerformancePage() {
  await requireUser();
  return <AppShell><PerformanceClient /></AppShell>;
}
