import { AppShell } from "@/components/AppShell";
import { EmotionalReviewClient } from "@/features/emotional/components/EmotionalReviewClient";
import { requireUser } from "@/lib/auth";

export default async function EmotionalPage() {
  await requireUser();
  return <AppShell wide><EmotionalReviewClient /></AppShell>;
}
