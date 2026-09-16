"use client";

import { useState, type FormEvent } from "react";
import { Drawer, FieldLabel, PrimaryButton, SelectInput, TextInput } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { TodoTask } from "../domain/todoTask";
import type { logTodoExecution } from "../api/todoApi";

export function TodoExecutionDrawer({ task, today, onClose, onSave }: { task: TodoTask; today: string; onClose: () => void; onSave: (payload: Parameters<typeof logTodoExecution>[0]) => Promise<void> }) {
  const { locale } = useLocale(); const fr = locale === "fr";
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<"done" | "partial" | "not_done">(task.status === "done" ? "done" : task.status === "not_done" ? "not_done" : "partial");
  const [minutes, setMinutes] = useState(task.workSessions?.find((session) => session.date === today)?.actualMinutes?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function selectDate(nextDate: string) {
    const session = task.workSessions?.find((entry) => entry.date === nextDate);
    setDate(nextDate);
    setMinutes(session?.actualMinutes?.toString() ?? "");
    if (session && ["done", "partial", "not_done"].includes(session.executionStatus)) {
      setResult(session.executionStatus as typeof result);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await onSave({ taskId: task.id, date, result, actualMinutes: result === "not_done" || minutes === "" ? null : Number(minutes) }); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save execution"); }
    finally { setBusy(false); }
  }
  return <Drawer open title={task.title} description={fr ? "Enregistrer le travail réalisé" : "Log actual execution"} onClose={busy ? () => undefined : onClose}><form onSubmit={(event) => void submit(event)} className="space-y-4"><FieldLabel>{fr ? "Date du travail" : "Work date"}<TextInput type="date" required max={today} value={date} onChange={(event) => selectDate(event.target.value)} /></FieldLabel><FieldLabel>{fr ? "Résultat" : "Result"}<SelectInput value={result} onChange={(event) => setResult(event.target.value as typeof result)}><option value="done">{fr ? "Terminé" : "Done"}</option><option value="partial">{fr ? "Partiel" : "Partial"}</option><option value="not_done">{fr ? "Non réalisé" : "Not done"}</option></SelectInput></FieldLabel><FieldLabel>{fr ? "Minutes réellement travaillées · facultatif" : "Actual minutes · optional"}<TextInput type="number" min={0} max={1440} disabled={result === "not_done"} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></FieldLabel><p className="text-xs leading-5 text-muted">{fr ? "Indique le total de cette tâche pour cette date. Une nouvelle saisie corrige ce total ; elle ne l’ajoute pas une seconde fois. L’estimation n’est jamais comptée comme du temps travaillé." : "Enter this task’s total for the selected date. Saving again corrects that total; it does not add it twice. Estimated time never counts as work performed."}</p>{error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}<PrimaryButton disabled={busy} type="submit">{busy ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Enregistrer l’exécution" : "Save execution")}</PrimaryButton></form>{task.workSessions?.length ? <div className="mt-5 space-y-2 border-t border-line pt-4"><p className="text-xs font-medium text-muted">{fr ? "Historique" : "History"}</p>{task.workSessions.map((session) => <button key={session.id} className="focus-ring flex w-full justify-between rounded-xl bg-panel2 p-3 text-xs" onClick={() => selectDate(session.date)}><span>{session.date}</span><span>{session.actualMinutes ?? "—"} min</span></button>)}</div> : null}</Drawer>;
}
