"use client";

import { Archive, CheckCircle2, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { GhostButton, ProgressBar, SecondaryButton } from "@/components/ui";
import { InlineTaskInput } from "@/features/week/components/InlineTaskInput";
import { proposeGoalSteps } from "../api/goalsApi";
import { toStepSelections, type Goal, type ProposedStep, type StepSelection } from "../domain/goal";
import type { GoalsCopy } from "./goalsCopy";
import { StepProposals } from "./StepProposals";

export type GoalCardActions = {
  rename: (goal: Goal, title: string) => Promise<void>;
  toggleDone: (goal: Goal) => Promise<void>;
  archive: (goal: Goal) => Promise<void>;
  addSteps: (goal: Goal, steps: ProposedStep[]) => Promise<void>;
};

type ProposalState = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; steps: StepSelection[] } | { kind: "failed"; message: string };

export function GoalCard({ goal, copy, isAiReady, actions }: {
  goal: Goal;
  copy: GoalsCopy;
  isAiReady: boolean;
  actions: GoalCardActions;
}): React.ReactElement {
  const [proposal, setProposal] = useState<ProposalState>({ kind: "idle" });
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const progressPercent = goal.tasksTotal ? Math.round((goal.tasksDone / goal.tasksTotal) * 100) : 0;

  async function requestProposals(): Promise<void> {
    setProposal({ kind: "loading" });
    try {
      const steps = await proposeGoalSteps(goal.id);
      setProposal({ kind: "ready", steps: toStepSelections(steps, String(Date.now())) });
    } catch (error: unknown) {
      setProposal({ kind: "failed", message: error instanceof Error ? error.message : copy.failed });
    }
  }

  function commitTitle(): void {
    const nextTitle = draftTitle?.trim();
    setDraftTitle(null);
    if (nextTitle && nextTitle !== goal.title) void actions.rename(goal, nextTitle);
  }

  return (
    <li className={`grid gap-3 rounded-[22px] bg-panel/90 p-4 ring-1 ring-line ${goal.isDone ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {draftTitle !== null ? (
          <input autoFocus aria-label={copy.rename} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} onBlur={commitTitle} onKeyDown={(event) => { if (event.key === "Enter") commitTitle(); if (event.key === "Escape") setDraftTitle(null); }} className="focus-ring min-w-0 flex-1 rounded-lg bg-panel2 px-2 py-1 text-lg font-semibold text-ink ring-1 ring-line" />
        ) : (
          <button type="button" title={copy.rename} onClick={() => setDraftTitle(goal.title)} className={`min-w-0 flex-1 break-words text-left text-lg font-semibold ${goal.isDone ? "text-muted line-through" : "text-ink"}`}>{goal.title}</button>
        )}
        <div className="flex gap-1">
          <GhostButton type="button" title={goal.isDone ? copy.reopen : copy.markDone} aria-label={goal.isDone ? copy.reopen : copy.markDone} onClick={() => void actions.toggleDone(goal)}>
            {goal.isDone ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </GhostButton>
          <GhostButton type="button" title={copy.archive} aria-label={copy.archive} onClick={() => void actions.archive(goal)}><Archive className="h-4 w-4" /></GhostButton>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar value={progressPercent} className="w-32" />
        <span className="text-xs text-muted">{goal.tasksTotal ? copy.progress.replace("{done}", String(goal.tasksDone)).replace("{total}", String(goal.tasksTotal)) : copy.noTasks}</span>
      </div>
      {goal.openTasks.length ? (
        <ul className="grid gap-1 text-sm">
          {goal.openTasks.map((task) => (
            <li key={task.id} className="flex items-baseline justify-between gap-2 rounded-lg bg-panel2/50 px-2 py-1">
              <span className="min-w-0 break-words text-ink">{task.title}</span>
              <span className="shrink-0 text-xs text-muted">{task.date ?? copy.unscheduled}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {!goal.isDone ? (
        <div className="grid gap-2">
          <InlineTaskInput label={copy.addStep} placeholder={copy.stepPlaceholder} onSubmit={(title) => actions.addSteps(goal, [{ title, detail: null }])} />
          {proposal.kind === "ready" ? (
            <StepProposals initialSteps={proposal.steps} copy={copy} onDiscard={() => setProposal({ kind: "idle" })} onAccept={async (steps) => { await actions.addSteps(goal, steps); setProposal({ kind: "idle" }); }} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <SecondaryButton type="button" disabled={!isAiReady || proposal.kind === "loading"} onClick={() => void requestProposals()}>
                {proposal.kind === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {proposal.kind === "loading" ? copy.proposing : copy.propose}
              </SecondaryButton>
              {!isAiReady ? <span className="text-xs text-muted">{copy.needsAi}</span> : null}
              {proposal.kind === "failed" ? <span role="alert" className="text-sm text-risk">{proposal.message}</span> : null}
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
