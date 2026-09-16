"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FieldLabel, PrimaryButton, SelectInput, TextInput } from "@/components/ui";
import { savePerformance } from "../api/performanceApi";
import type { ExecutionStatus } from "../domain/performance";

export function BlockExecutionForm({ block, onSaved }: {
  block: { id: string; executionStatus: ExecutionStatus; actualMinutes: number | null };
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<ExecutionStatus>(block.executionStatus);
  const [minutes, setMinutes] = useState(block.actualMinutes?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const controller = new AbortController();
    request.current = controller;
    setSaving(true); setError("");
    try {
      await savePerformance("block", { id: block.id, executionStatus: status,
        actualMinutes: status === "planned" || status === "not_done" || minutes === "" ? null : Number(minutes) }, controller.signal);
      onSaved();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to save execution");
    } finally { if (!controller.signal.aborted) setSaving(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <div><FieldLabel htmlFor="execution-status">Result</FieldLabel>
      <SelectInput id="execution-status" value={status} onChange={(event) => setStatus(event.target.value as ExecutionStatus)} className="mt-2">
        <option value="planned">Not logged yet</option><option value="done">Done</option><option value="partial">Partial</option><option value="not_done">Not done</option>
      </SelectInput></div>
    <div><FieldLabel htmlFor="execution-minutes">Actual focused minutes · optional</FieldLabel>
      <TextInput id="execution-minutes" type="number" min={0} max={1440} step={1} value={minutes} disabled={status === "planned" || status === "not_done"} onChange={(event) => setMinutes(event.target.value)} className="mt-2" /></div>
    <p className="text-sm text-muted">Only recorded work / study minutes generate time value. Marking a block done never assumes its planned duration was worked.</p>
    {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
    <PrimaryButton disabled={saving} type="submit">{saving ? "Saving…" : "Save execution"}</PrimaryButton>
  </form>;
}
