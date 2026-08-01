import { CirclePlus } from "lucide-react";
import { formatDuration } from "@/components/DurationInput";
import { Card, GhostButton, Pill } from "@/components/ui";
import type {
  ObjectiveWeeklyDay,
  WeeklyPlanBlock
} from "@/features/objectives/domain/objective";

type ObjectiveWeeklyPlannerProps = {
  weeklyDays: ObjectiveWeeklyDay[];
  totalMinutesLabel: string;
  highLoadDayCount: number;
  onCreateBlock: (date: string) => void;
  onEditBlock: (block: WeeklyPlanBlock) => void;
};

export function ObjectiveWeeklyPlanner({
  weeklyDays,
  totalMinutesLabel,
  highLoadDayCount,
  onCreateBlock,
  onEditBlock
}: ObjectiveWeeklyPlannerProps) {
  return (
    <Card>
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Week anticipation</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">Monday to Sunday planning</h2>
          <p className="mt-2 text-sm text-slate-400">
            Weekdays hold committed execution. Saturday and Sunday stay visible, but softer and more flexible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-400">
          <span>Total load: {totalMinutesLabel}</span>
          <span>High-load days: {highLoadDayCount}</span>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-7">
        {weeklyDays.map((day) => (
          <div
            key={day.date}
            className={`flex min-h-[360px] flex-col rounded-[22px] p-3 ring-1 ${
              day.isWeekend ? "bg-white/[0.03] ring-white/5" : "bg-white/[0.04] ring-white/8"
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{day.label}</p>
                <p className="mt-1 text-base font-semibold text-slate-50">{day.date.slice(5)}</p>
                <p className="mt-1 text-xs text-slate-500">{day.loadLabel}</p>
              </div>
              <GhostButton onClick={() => onCreateBlock(day.date)} className="min-h-9 rounded-2xl bg-white/[0.03] px-2.5 ring-1 ring-white/8">
                <CirclePlus className="h-4 w-4" />
              </GhostButton>
            </div>

            {day.events.length > 0 ? (
              <div className="space-y-2">
                {day.events.map((calendarEvent) => (
                  <div key={calendarEvent.id} className="rounded-[16px] bg-white/[0.03] px-3 py-2 ring-1 ring-white/6">
                    <p className="truncate text-xs font-semibold text-slate-200">{calendarEvent.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{calendarEvent.timeLabel} · {calendarEvent.impact}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{day.isWeekend ? "Weekend kept flexible." : "No calendar constraint."}</p>
            )}

            <div className="mt-3 flex-1 space-y-2">
              {day.blocks.length === 0 ? (
                <div className="rounded-[16px] bg-black/10 px-3 py-6 text-center text-sm text-slate-500 ring-1 ring-white/5">
                  No planned block.
                </div>
              ) : (
                day.blocks.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => onEditBlock(block)}
                    className="w-full rounded-[18px] bg-white/[0.04] p-3 text-left ring-1 ring-white/6 transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{block.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {block.startTime && block.endTime ? `${block.startTime} - ${block.endTime}` : "Flexible timing"} · {formatDuration(block.durationMinutes)}
                        </p>
                      </div>
                      <Pill>{block.category}</Pill>
                    </div>
                    {block.objectiveTitle ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/8">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: block.objectiveColor ?? "#8da2fb" }} />
                        {block.objectiveTitle}
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
