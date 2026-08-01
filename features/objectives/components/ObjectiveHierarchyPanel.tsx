import { CirclePlus, Sparkles } from "lucide-react";
import {
  Card,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
  Segmented,
  SegmentedButton,
  SoftPanel
} from "@/components/ui";
import type { ObjectiveSummary, ObjectivesData } from "@/features/objectives/domain/objective";
import { ObjectiveMapView } from "./ObjectiveMapView";
import { ObjectiveTreeNode } from "./ObjectiveTreeNode";

export type ObjectiveStructureView = "map" | "tree";

type ObjectiveHierarchyPanelProps = {
  data: ObjectivesData;
  structureView: ObjectiveStructureView;
  isSaving: boolean;
  onChangeStructureView: (view: ObjectiveStructureView) => void;
  onCreateObjective: (parentId?: string) => void;
  onEditObjective: (objective: ObjectiveSummary) => void;
  onInstallDemo: () => void;
};

export function ObjectiveHierarchyPanel({
  data,
  structureView,
  isSaving,
  onChangeStructureView,
  onCreateObjective,
  onEditObjective,
  onInstallDemo
}: ObjectiveHierarchyPanelProps) {
  const objectivesById = new Map(data.objectives.map((objective) => [objective.id, objective]));

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Hierarchy</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">From direction to concrete week</h2>
          <p className="mt-2 text-sm text-slate-400">
            Read left to right: the yearly direction should become a quarter focus, then a month, then a week you can actually execute.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented>
            <SegmentedButton active={structureView === "map"} onClick={() => onChangeStructureView("map")} type="button">
              Map
            </SegmentedButton>
            <SegmentedButton active={structureView === "tree"} onClick={() => onChangeStructureView("tree")} type="button">
              Tree
            </SegmentedButton>
          </Segmented>
          <GhostButton onClick={() => onCreateObjective()} className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8">
            <CirclePlus className="h-4 w-4" />
            Add
          </GhostButton>
        </div>
      </div>

      {data.tree.length === 0 ? (
        <SoftPanel className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Start with a small objective tree</h3>
            <p className="mt-2 text-sm text-slate-400">
              Create a yearly direction, break it into quarter and month goals, then anchor the current week with projects and milestones.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {data.suggestedTemplates.map((template) => (
              <div key={template.title} className="rounded-[18px] bg-white/[0.035] p-3 ring-1 ring-white/6">
                <p className="text-sm font-semibold text-slate-100">{template.title}</p>
                <p className="mt-1 text-xs text-slate-500">{template.summary}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={onInstallDemo} disabled={isSaving}>
              <Sparkles className="h-4 w-4" />
              Install starter structure
            </PrimaryButton>
            <SecondaryButton onClick={() => onCreateObjective()}>Create manually</SecondaryButton>
          </div>
        </SoftPanel>
      ) : structureView === "map" ? (
        <ObjectiveMapView
          objectives={data.objectives}
          tree={data.tree}
          onEditObjective={onEditObjective}
        />
      ) : (
        <div className="space-y-3">
          {data.tree.map((node) => (
            <ObjectiveTreeNode
              key={node.id}
              node={node}
              onEdit={(objectiveId) => {
                const objective = objectivesById.get(objectiveId);
                if (objective) onEditObjective(objective);
              }}
              onCreateChild={onCreateObjective}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
