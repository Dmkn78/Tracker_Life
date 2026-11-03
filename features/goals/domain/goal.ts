export type GoalTask = { id: string; title: string; date: string | null };

export type Goal = {
  id: string;
  title: string;
  summary: string | null;
  isDone: boolean;
  tasksDone: number;
  tasksTotal: number;
  openTasks: GoalTask[];
};

export type ProposedStep = { title: string; detail: string | null };

/** A proposal the user can edit or untick before anything is created. */
export type StepSelection = ProposedStep & { key: string; isSelected: boolean };

/** New general goals use a quarter horizon: long enough to matter, short enough to review. */
export const DEFAULT_GOAL_HORIZON = "quarter";

export function selectStepsToCreate(steps: StepSelection[]): ProposedStep[] {
  const selectedSteps = steps
    .filter((step) => step.isSelected && step.title.trim())
    .map((step) => ({ title: step.title.trim(), detail: step.detail?.trim() || null }));
  return selectedSteps;
}

export function toStepSelections(steps: ProposedStep[], batchKey: string): StepSelection[] {
  const selections = steps.map((step, index) => ({ ...step, key: `${batchKey}:${index}`, isSelected: true }));
  return selections;
}
