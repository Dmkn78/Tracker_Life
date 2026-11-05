import { AppShell } from "@/components/AppShell";
import { CoursesView } from "@/features/courses/components/CoursesView";
import { requireUser } from "@/lib/auth";

export default async function CoursesPage() {
  await requireUser();
  return (
    <AppShell>
      <CoursesView />
    </AppShell>
  );
}
