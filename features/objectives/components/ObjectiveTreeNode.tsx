import { ChevronDown, CirclePlus, Link2, PencilLine } from "lucide-react";
import { GhostButton, Pill } from "@/components/ui";
import type { ObjectiveTreeNode as ObjectiveTreeNodeData } from "@/features/objectives/domain/objective";
import { formatMinutes } from "@/features/objectives/domain/objectiveUi";
import {
  getObjectiveKindTone,
  getObjectivePriorityTone,
  getObjectiveStatusTone
} from "./objectivePresentation";

type ObjectiveTreeNodeProps = {
  node: ObjectiveTreeNodeData;
  onEdit: (objectiveId: string) => void;
  onCreateChild: (parentId: string) => void;
  depth?: number;
};

export function ObjectiveTreeNode({
  node,
  onEdit,
  onCreateChild,
  depth = 0
}: ObjectiveTreeNodeProps) {
  const isOpenByDefault = depth < 2;
  return (
    <details open={isOpenByDefault} className="rounded-[22px] bg-white/[0.03] p-3 ring-1 ring-white/6">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: node.color }} />
            <p className="truncate text-sm font-semibold text-slate-50">{node.title}</p>
            <Pill>{node.horizon}</Pill>
            <Pill className={getObjectiveKindTone(node.kind)}>{node.kind}</Pill>
            <Pill className={getObjectiveStatusTone(node.status)}>{node.status}</Pill>
            <Pill className={getObjectivePriorityTone(node.priority)}>{node.priority}</Pill>
          </div>
          {node.summary ? <p className="mt-2 line-clamp-2 text-sm text-slate-400">{node.summary}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill>{node.weeklyMinutes ? formatMinutes(node.weeklyMinutes) : "0m"}</Pill>
          <GhostButton
            onClick={(event) => {
              event.preventDefault();
              onCreateChild(node.id);
            }}
            className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8"
          >
            <CirclePlus className="h-4 w-4" />
          </GhostButton>
          <GhostButton
            onClick={(event) => {
              event.preventDefault();
              onEdit(node.id);
            }}
            className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8"
          >
            <PencilLine className="h-4 w-4" />
          </GhostButton>
        </div>
      </summary>

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-[18px] bg-black/10 px-3 py-3 ring-1 ring-white/5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Next action</p>
              <span className="text-xs text-slate-500">{node.linkedTasksCount} tasks linked</span>
            </div>
            <p className="text-sm text-slate-300">{node.nextAction || "Define the next concrete move."}</p>
          </div>
          <div className="grid gap-2 md:min-w-[180px]">
            <ObjectiveMiniStat label="Completion" value={`${node.completionPercent}%`} />
            <ObjectiveMiniStat label="Blocks" value={String(node.weeklyBlocksCount)} />
          </div>
        </div>

        {node.linkedTasks.length > 0 ? (
          <div className="rounded-[18px] bg-white/[0.03] p-3 ring-1 ring-white/6">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              <Link2 className="h-3.5 w-3.5" />
              Linked tasks
            </div>
            <div className="space-y-2">
              {node.linkedTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-black/10 px-3 py-2 ring-1 ring-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.date} · {task.status}</p>
                  </div>
                  <Pill>{task.completionPercent}%</Pill>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {node.children.length > 0 ? (
          <div className="space-y-3 border-l border-white/8 pl-4">
            {node.children.map((child) => (
              <ObjectiveTreeNode
                key={child.id}
                node={child}
                onEdit={onEdit}
                onCreateChild={onCreateChild}
                depth={depth + 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ObjectiveMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-white/[0.03] px-3 py-2 text-right ring-1 ring-white/6">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
