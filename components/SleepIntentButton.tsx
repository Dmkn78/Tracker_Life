"use client";

import { Moon } from "lucide-react";
import { useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { toDateKey } from "@/lib/dates";

export function SleepIntentButton({ date = toDateKey() }: { date?: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function markSleep() {
    setLoading(true);
    const existing = await fetch(`/api/daily-log?date=${date}`).then((response) => response.json());
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(existing.log ?? {}),
        date,
        status: existing.log?.status === "submitted" ? "submitted" : "draft",
        sleepIntentClickedAt: new Date().toISOString(),
        estimatedSleepDelayMin: existing.log?.estimatedSleepDelayMin ?? 20
      })
    });
    setSaved(true);
    setLoading(false);
  }

  return (
    <PrimaryButton onClick={markSleep} disabled={loading}>
      <Moon className="h-4 w-4" />
      {saved ? "Sleep intent saved" : loading ? "Saving..." : "I am going to sleep"}
    </PrimaryButton>
  );
}
