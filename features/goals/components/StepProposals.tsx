"use client";

import { useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { selectStepsToCreate, type ProposedStep, type StepSelection } from "../domain/goal";
import type { GoalsCopy } from "./goalsCopy";

export function StepProposals({ initialSteps, copy, onAccept, onDiscard }: {
  initialSteps: StepSelection[];
  copy: GoalsCopy;
  onAccept: (steps: ProposedStep[]) => Promise<void>;
  onDiscard: () => void;
}): React.ReactElement {
  const [steps, setSteps] = useState(initialSteps);
  const [isSaving, setIsSaving] = useState(false);
  const stepsToCreate = selectStepsToCreate(steps);

  function changeStep(key: string, change: Partial<StepSelection>): void {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...change } : step)));
  }

  async function accept(): Promise<void> {
    setIsSaving(true);
    try {
      await onAccept(stepsToCreate);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-2xl bg-violet/10 p-3 ring-1 ring-violet/30">
      <p className="text-sm font-semibold text-ink">{copy.proposalsTitle}</p>
      <p className="text-xs text-muted">{copy.proposalsHint}</p>
      <ul className="grid gap-1.5">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2">
            <input type="checkbox" aria-label={step.title} checked={step.isSelected} onChange={(event) => changeStep(step.key, { isSelected: event.target.checked })} className="mt-2.5 h-4 w-4 accent-[rgb(var(--color-accent))]" />
            <div className="min-w-0 flex-1">
              <input value={step.title} aria-label={copy.rename} onChange={(event) => changeStep(step.key, { title: event.target.value })} className="focus-ring w-full rounded-lg bg-panel px-2 py-1.5 text-sm text-ink ring-1 ring-line" />
              {step.detail ? <p className="mt-0.5 px-1 text-xs text-muted">{step.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" disabled={!stepsToCreate.length || isSaving} onClick={() => void accept()}>{copy.addSelected.replace("{count}", String(stepsToCreate.length))}</PrimaryButton>
        <SecondaryButton type="button" onClick={onDiscard}>{copy.discard}</SecondaryButton>
      </div>
    </div>
  );
}
