"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { useDefaultAiProvider } from "@/features/ai-providers/application/useDefaultAiProvider";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { addGoalSteps, archiveGoal, createGoal, fetchGoals, markGoalDone, renameGoal, reopenGoal } from "../api/goalsApi";
import type { Goal } from "../domain/goal";
import { GoalCard, type GoalCardActions } from "./GoalCard";
import { GOALS_COPY } from "./goalsCopy";

export function GoalsView(): React.ReactElement {
  const { locale } = useLocale();
  const copy = GOALS_COPY[locale];
  const providerState = useDefaultAiProvider();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async (): Promise<void> => {
    try {
      setGoals(await fetchGoals());
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : copy.failed);
    }
  }, [copy.failed]);

  useEffect(() => { void reload(); }, [reload]);

  async function run(action: () => Promise<void>): Promise<void> {
    setError("");
    try {
      await action();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : copy.failed);
    }
    await reload();
  }

  async function submitGoal(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    await run(() => createGoal(title));
  }

  const actions: GoalCardActions = {
    rename: (goal, title) => run(() => renameGoal(goal.id, title)),
    toggleDone: (goal) => run(() => (goal.isDone ? reopenGoal(goal.id) : markGoalDone(goal.id))),
    archive: (goal) => (window.confirm(copy.confirmArchive) ? run(() => archiveGoal(goal.id)) : Promise.resolve()),
    addSteps: (goal, steps) => run(() => addGoalSteps(goal.id, steps))
  };
  const activeGoals = goals?.filter((goal) => !goal.isDone) ?? [];
  const doneGoals = goals?.filter((goal) => goal.isDone) ?? [];
  const isAiReady = providerState.kind === "ready";

  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm font-semibold uppercase text-accent">{copy.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{copy.hint}</p>
      </header>
      <form onSubmit={(event) => void submitGoal(event)} className="flex flex-col gap-2 rounded-[22px] bg-panel p-2 ring-1 ring-line sm:flex-row">
        <input aria-label={copy.title} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={copy.placeholder} className="focus-ring min-h-11 min-w-0 flex-1 rounded-2xl bg-transparent px-3 text-base text-ink placeholder:text-muted/70" />
        <PrimaryButton type="submit" disabled={!newTitle.trim()} className="min-h-11"><Plus className="h-4 w-4" />{copy.add}</PrimaryButton>
      </form>
      {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
      {goals === null ? <p className="text-sm text-muted">{copy.loading}</p> : null}
      {goals !== null && !goals.length ? <p className="text-sm text-muted">{copy.empty}</p> : null}
      <ul className="grid gap-3">
        {activeGoals.map((goal) => <GoalCard key={goal.id} goal={goal} copy={copy} isAiReady={isAiReady} actions={actions} />)}
      </ul>
      {doneGoals.length ? (
        <details className="grid gap-3">
          <summary className="cursor-pointer text-sm font-medium text-muted">{copy.doneSection} ({doneGoals.length})</summary>
          <ul className="mt-3 grid gap-3">
            {doneGoals.map((goal) => <GoalCard key={goal.id} goal={goal} copy={copy} isAiReady={isAiReady} actions={actions} />)}
          </ul>
        </details>
      ) : null}
      <Link href="/objectives/planning" className="focus-ring w-fit text-sm text-accent">{copy.advanced} →</Link>
    </div>
  );
}
