import type {
  ObjectiveHorizon,
  ObjectiveKind,
  ObjectivePriority,
  ObjectiveStatus
} from "@/features/objectives/domain/objective";

export function getObjectiveHorizonTitle(horizon: ObjectiveHorizon): string {
  if (horizon === "year") return "North star";
  if (horizon === "quarter") return "Strategic bet";
  if (horizon === "month") return "Deliverable";
  return "Execution layer";
}

export function getObjectiveHorizonDescription(horizon: ObjectiveHorizon): string {
  if (horizon === "year") return "The outcome that defines the direction of the year.";
  if (horizon === "quarter") return "The main focus that should receive most of the quarter's energy.";
  if (horizon === "month") return "A concrete result you want visible by month end.";
  return "What is actually scheduled, shipped, reviewed, or protected this week.";
}

export function getObjectiveStatusTone(status: ObjectiveStatus): string {
  if (status === "done") return "bg-good/10 text-good ring-good/15";
  if (status === "at_risk") return "bg-risk/10 text-risk ring-risk/15";
  if (status === "active" || status === "on_track") {
    return "bg-white/[0.06] text-slate-200 ring-white/10";
  }
  return "bg-white/[0.03] text-slate-400 ring-white/8";
}

export function getObjectivePriorityTone(priority: ObjectivePriority): string {
  if (priority === "critical") return "bg-risk/10 text-risk ring-risk/15";
  if (priority === "high") return "bg-warn/10 text-warn ring-warn/15";
  return "bg-white/[0.03] text-slate-400 ring-white/8";
}

export function getObjectiveKindTone(kind: ObjectiveKind): string {
  if (kind === "project") return "bg-accent/12 text-accent ring-accent/15";
  if (kind === "milestone") return "bg-good/10 text-good ring-good/15";
  return "bg-white/[0.03] text-slate-400 ring-white/8";
}
