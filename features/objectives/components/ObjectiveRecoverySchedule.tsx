"use client";

import { useRef, useState } from "react";
import { FieldLabel, PrimaryButton, SoftPanel, TextInput } from "@/components/ui";
import type { ObjectiveInsight, PlanningMutation } from "../domain/planning";
import { hours } from "../domain/planning";

export function ObjectiveRecoverySchedule({ insight, today, busy, onSave }: { insight: ObjectiveInsight; today: string; busy: boolean; onSave: (mutation: PlanningMutation) => Promise<boolean> }) {
  const [startDate, setStartDate] = useState(today);
  const [days, setDays] = useState(insight.recoveryDays);
  const [minutes, setMinutes] = useState(Math.min(240, insight.recoveryDailyMinutes || 30));
  const request = useRef<{ signature: string; id: string } | null>(null);
  if (insight.progress >= 100) return null;
  return <SoftPanel><h4 className="text-sm font-medium">Schedule a recovery plan</h4><p className="mt-2 text-xs leading-5 text-muted">Review the workload before adding flexible blocks. Time is only credited after execution. Calendar commitments remain visible in Weekly.</p><form onSubmit={async (event) => {
    event.preventDefault();
    const signature = `${insight.objectiveId}:${startDate}:${days}:${minutes}`;
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    if (await onSave({ path: "recovery-schedule", method: "POST", body: { requestId: request.current.id, objectiveId: insight.objectiveId, startDate, days, dailyMinutes: minutes } })) request.current = null;
  }} className="mt-3 grid gap-3 sm:grid-cols-3"><FieldLabel>Start<TextInput aria-label="Recovery plan start" type="date" required min={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></FieldLabel><FieldLabel>Calendar days<TextInput aria-label="Recovery plan days" type="number" required min={1} max={14} value={days} onChange={(event) => setDays(Number(event.target.value))} /></FieldLabel><FieldLabel>Minutes per day<TextInput aria-label="Recovery plan minutes per day" type="number" required min={1} max={240} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></FieldLabel><div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3"><p className="text-sm">{days} flexible blocks · {hours(days * minutes)} total · includes weekends</p><PrimaryButton type="submit" disabled={busy}>Schedule recovery</PrimaryButton></div></form></SoftPanel>;
}
