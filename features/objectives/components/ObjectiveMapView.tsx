import { Pill, SoftPanel } from "@/components/ui";
import type {
  ObjectiveHorizon,
  ObjectiveSummary
} from "@/features/objectives/domain/objective";
import { buildObjectivePaths } from "@/features/objectives/domain/objectivePaths";
import { formatMinutes } from "@/features/objectives/domain/objectiveUi";
import {
  getObjectiveHorizonDescription,
  getObjectiveHorizonTitle,
  getObjectiveKindTone,
  getObjectivePriorityTone,
  getObjectiveStatusTone
} from "./objectivePresentation";

const OBJECTIVE_HORIZONS: ObjectiveHorizon[] = ["year", "quarter", "month", "week"];

type ObjectiveMapViewProps = {
  objectives: ObjectiveSummary[];
  tree: Parameters<typeof buildObjectivePaths>[0];
  onEditObjective: (objective: ObjectiveSummary) => void;
};

export function ObjectiveMapView({
  objectives,
  tree,
  onEditObjective
}: ObjectiveMapViewProps) {
  const objectivePaths = buildObjectivePaths(tree);
  const objectivesByHorizon = buildObjectivesByHorizon(objectives);
  const objectivesById = new Map(objectives.map((objective) => [objective.id, objective]));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {objectivesByHorizon.map((column) => (
          <SoftPanel key={column.horizon} className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{column.horizon}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{getObjectiveHorizonTitle(column.horizon)}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{getObjectiveHorizonDescription(column.horizon)}</p>
            <p className="mt-3 text-xs text-slate-500">
              {column.objectiveCount} {column.objectiveCount > 1 ? "items" : "item"}
            </p>
          </SoftPanel>
        ))}
      </div>

      <div className="space-y-4">
        {objectivePaths.map((path, pathIndex) => (
          <SoftPanel key={path.key} className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Strategic path {pathIndex + 1}</p>
                <p className="mt-1 truncate text-base font-semibold text-slate-50">
                  {path.leaf?.title ?? path.root?.title ?? "Objective path"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {path.leaf?.nextAction || path.leaf?.summary || path.root?.summary || "Define the next concrete move for this branch."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Pill>{path.totalLinkedTasks} tasks</Pill>
                <Pill>{formatMinutes(path.totalWeeklyMinutes)} planned</Pill>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-4">
              {OBJECTIVE_HORIZONS.map((horizon, columnIndex) => {
                const objective = path.nodes[horizon];
                const hasFollowingColumn = columnIndex < OBJECTIVE_HORIZONS.length - 1;
                return (
                  <div key={`${path.key}-${horizon}`} className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{horizon}</p>
                      {hasFollowingColumn ? <span className="text-xs text-slate-600">→</span> : null}
                    </div>
                    {objective ? (
                      <button
                        type="button"
                        onClick={() => {
                          const objectiveSummary = objectivesById.get(objective.id);
                          if (objectiveSummary) onEditObjective(objectiveSummary);
                        }}
                        className="flex h-full min-h-[190px] w-full flex-col rounded-[20px] bg-white/[0.04] p-4 text-left ring-1 ring-white/6 transition hover:bg-white/[0.06]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: objective.color }} />
                              <p className="truncate text-sm font-semibold text-slate-50">{objective.title}</p>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">{getObjectiveHorizonTitle(horizon)}</p>
                          </div>
                          <Pill className={getObjectivePriorityTone(objective.priority)}>{objective.priority}</Pill>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Pill className={getObjectiveKindTone(objective.kind)}>{objective.kind}</Pill>
                          <Pill className={getObjectiveStatusTone(objective.status)}>{objective.status.replace("_", " ")}</Pill>
                        </div>
                        <p className="mt-3 line-clamp-4 flex-1 text-sm leading-6 text-slate-300">
                          {objective.nextAction || objective.summary || "Define the next concrete move."}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>{objective.linkedTasksCount} linked tasks</span>
                          <span>{formatMinutes(objective.weeklyMinutes)} planned</span>
                        </div>
                      </button>
                    ) : (
                      <div className="flex min-h-[190px] items-center rounded-[20px] bg-black/10 px-4 text-sm text-slate-500 ring-1 ring-dashed ring-white/8">
                        No {horizon} layer yet.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SoftPanel>
        ))}
      </div>
    </div>
  );
}

function buildObjectivesByHorizon(objectives: ObjectiveSummary[]) {
  return OBJECTIVE_HORIZONS.map((horizon) => ({
    horizon,
    objectiveCount: objectives.filter((objective) => objective.horizon === horizon).length
  }));
}
