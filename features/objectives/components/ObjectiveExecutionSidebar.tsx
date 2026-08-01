import { Card, Pill, SoftPanel } from "@/components/ui";
import type {
  ObjectiveAllocation,
  ObjectiveNextAction
} from "@/features/objectives/domain/objective";
import { formatMinutes } from "@/features/objectives/domain/objectiveUi";
import { getObjectivePriorityTone } from "./objectivePresentation";

type ObjectiveExecutionSidebarProps = {
  nextActions: ObjectiveNextAction[];
  allocation: ObjectiveAllocation[];
  totalWeeklyMinutes: number;
};

export function ObjectiveExecutionSidebar({
  nextActions,
  allocation,
  totalWeeklyMinutes
}: ObjectiveExecutionSidebarProps) {
  return (
    <div className="space-y-4">
      <ObjectiveNextActions nextActions={nextActions} />
      <ObjectiveWeeklyAllocation allocation={allocation} totalWeeklyMinutes={totalWeeklyMinutes} />
    </div>
  );
}

function ObjectiveNextActions({ nextActions }: { nextActions: ObjectiveNextAction[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Execution</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">Next actions</h2>
        </div>
        <Pill>{nextActions.length} live</Pill>
      </div>
      <div className="space-y-3">
        {nextActions.length === 0 ? (
          <p className="text-sm text-slate-500">No active objectives yet.</p>
        ) : (
          nextActions.map((nextAction) => (
            <SoftPanel key={nextAction.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-50">{nextAction.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{nextAction.nextAction}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Pill className={getObjectivePriorityTone(nextAction.priority)}>{nextAction.priority}</Pill>
                  <Pill>{nextAction.horizon}</Pill>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{nextAction.linkedTasksCount} linked tasks</span>
                <span>{formatMinutes(nextAction.weeklyMinutes)} planned</span>
              </div>
            </SoftPanel>
          ))
        )}
      </div>
    </Card>
  );
}

function ObjectiveWeeklyAllocation({
  allocation,
  totalWeeklyMinutes
}: {
  allocation: ObjectiveAllocation[];
  totalWeeklyMinutes: number;
}) {
  return (
    <Card>
      <div className="mb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Weekly allocation</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-50">Time by objective</h2>
      </div>
      <div className="space-y-3">
        {allocation.length === 0 ? (
          <p className="text-sm text-slate-500">No weekly blocks yet. Add a few planned blocks to see the weekly balance.</p>
        ) : (
          allocation.map((allocationItem) => {
            const allocationPercent = totalWeeklyMinutes
              ? Math.max(8, Math.round((allocationItem.minutes / totalWeeklyMinutes) * 100))
              : 0;
            return (
              <div key={allocationItem.key} className="rounded-[18px] bg-white/[0.035] p-3 ring-1 ring-white/6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: allocationItem.color }} />
                      <p className="truncate text-sm font-semibold text-slate-100">{allocationItem.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{allocationItem.dayCount} days worked · {allocationItem.blocks} blocks</p>
                  </div>
                  <Pill>{allocationItem.minutesLabel}</Pill>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${allocationPercent}%`, backgroundColor: allocationItem.color }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allocationItem.daysWorked.map((day) => (
                    <Pill key={day} className="text-[11px]">{day.slice(5)}</Pill>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
