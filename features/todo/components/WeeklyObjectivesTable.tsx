"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { FieldLabel, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/ui";
import { formatDuration } from "@/components/DurationInput";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { ObjectiveOption } from "../domain/todoTask";
import type { WeeklyObjectiveRow } from "../domain/weeklyObjectives";

type WeeklyObjectivesTableProps = {
  weekId: string;
  rows: WeeklyObjectiveRow[];
  objectives: ObjectiveOption[];
  selectedObjectiveId: string;
  onSelect: (objectiveId: string) => void;
  onCreate: (input: { title: string; weekId: string }) => Promise<ObjectiveOption>;
};

export function WeeklyObjectivesTable({ weekId, rows, objectives, selectedObjectiveId, onSelect, onCreate }: WeeklyObjectivesTableProps) {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createObjective(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const createdObjective = await onCreate({ title: title.trim(), weekId });
      onSelect(createdObjective.id);
      setTitle("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fr ? "Impossible de créer l’objectif." : "Could not create the objective.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mb-6 space-y-3" aria-label={fr ? "Objectifs de la semaine" : "Weekly objectives"}>
    <div><h3 className="font-semibold">1. {fr ? "Objectifs de la semaine" : "Weekly objectives"}</h3><p className="mt-1 text-xs text-muted">{fr ? "Définis ce que tu veux accomplir, puis ajoute les actions concrètes pour chaque objectif." : "Choose what you want to accomplish, then define concrete actions for each objective."}</p></div>
    <form onSubmit={(event) => void createObjective(event)} className="flex flex-wrap items-end gap-2">
      <FieldLabel className="min-w-48 flex-1">{fr ? "Nouvel objectif" : "New objective"}<TextInput className="mt-1" maxLength={500} placeholder={fr ? "Ex. Maîtriser le chapitre 3 de maths" : "E.g. Understand chapter 3 of maths"} value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy} /></FieldLabel>
      <PrimaryButton type="submit" disabled={busy || !title.trim()}><Plus className="h-4 w-4" />{busy ? (fr ? "Création…" : "Creating…") : (fr ? "Ajouter l’objectif" : "Add objective")}</PrimaryButton>
    </form>
    {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
    {rows.length ? <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[530px] text-left text-sm">
      <thead className="bg-panel2 text-xs text-muted"><tr><th className="px-3 py-2">{fr ? "Objectif" : "Objective"}</th><th className="px-3 py-2">{fr ? "Actions terminées / total" : "Actions completed / total"}</th><th className="px-3 py-2">{fr ? "Planifié cette semaine" : "Scheduled this week"}</th><th className="px-3 py-2"><span className="sr-only">{fr ? "Définir les actions" : "Define actions"}</span></th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.objective.id} className={`border-t border-line ${selectedObjectiveId === row.objective.id ? "bg-accent/10" : ""}`}>
        <td className="max-w-72 break-words px-3 py-3 font-medium">{row.objective.title}</td><td className="px-3 py-3">{row.completedTasks} / {row.tasks.length}</td>
        <td className="px-3 py-3"><span className="font-medium">{formatDuration(row.scheduledMinutes)}</span><span className="ml-2 text-xs text-muted">({row.scheduledTasks} actions)</span></td>
        <td className="px-3 py-3"><SecondaryButton aria-pressed={selectedObjectiveId === row.objective.id} onClick={() => onSelect(row.objective.id)}>{fr ? "Définir les actions" : "Define actions"}</SecondaryButton></td>
      </tr>)}</tbody>
    </table></div> : <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{fr ? "Ton tableau est prêt. Ajoute ton premier objectif pour cette semaine." : "Your table is ready. Add your first objective for this week."}</p>}
    <FieldLabel className="block max-w-lg">{fr ? "Objectif pour les actions ci-dessous" : "Objective for the actions below"}<SelectInput className="mt-1" value={selectedObjectiveId} onChange={(event) => onSelect(event.target.value)}>
      <option value="">{fr ? "Toutes les actions · nouvelle action sans objectif" : "All actions · new action without an objective"}</option>{objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.title}</option>)}
    </SelectInput></FieldLabel>
  </section>;
}
