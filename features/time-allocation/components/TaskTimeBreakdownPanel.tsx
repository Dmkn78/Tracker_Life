"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/components/DurationInput";
import { Metric, Segmented, SegmentedButton, SoftPanel } from "@/components/ui";
import { loadTaskTimeBreakdown } from "@/features/time-allocation/api/timeAllocationApi";
import type {
  TaskTimeBreakdown,
  TaskTimeBreakdownEntry,
  TaskTimeBreakdownPeriod
} from "@/features/time-allocation/domain/timeAllocation";
import { ApiError } from "@/lib/http/apiClient";

export function TaskTimeBreakdownPanel({ date }: { date: string }) {
  const [period, setPeriod] = useState<TaskTimeBreakdownPeriod>("week");
  const [data, setData] = useState<TaskTimeBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestController = new AbortController();
    setError(null);
    void loadTaskTimeBreakdown(period, date, requestController.signal)
      .then(setData)
      .catch((loadError: unknown) => {
        if (!requestController.signal.aborted) {
          setError(loadError instanceof ApiError ? loadError.message : "Unable to load the task time breakdown.");
        }
      });
    return () => requestController.abort();
  }, [period, date]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Time from task estimates, grouped by tag and by company.</p>
        <Segmented>
          {(["week", "month"] as const).map((item) => (
            <SegmentedButton key={item} active={period === item} onClick={() => setPeriod(item)}>
              {item === "week" ? "This week" : "This month"}
            </SegmentedButton>
          ))}
        </Segmented>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-risk/10 px-4 py-3 text-sm text-risk ring-1 ring-risk/15">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Total planned" value={formatDuration(data.totalMinutes)} detail={`${data.taskCount} task${data.taskCount === 1 ? "" : "s"}`} />
            <Metric
              label={data.period === "week" ? "Week" : "Month"}
              value={`${data.rangeStart} → ${data.rangeEnd}`}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownList
              title="By company"
              entries={data.byCompany}
              unassignedLabel="No company"
              unassignedMinutes={data.noCompanyMinutes}
              totalMinutes={data.totalMinutes}
            />
            <BreakdownList
              title="By tag"
              entries={data.byTag}
              unassignedLabel="No tag"
              unassignedMinutes={data.untaggedMinutes}
              totalMinutes={data.totalMinutes}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function BreakdownList({
  title,
  entries,
  unassignedLabel,
  unassignedMinutes,
  totalMinutes
}: {
  title: string;
  entries: TaskTimeBreakdownEntry[];
  unassignedLabel: string;
  unassignedMinutes: number;
  totalMinutes: number;
}) {
  const rows = [
    ...entries,
    ...(unassignedMinutes > 0 ? [{ id: "__unassigned", name: unassignedLabel, color: "#5b6577", minutes: unassignedMinutes }] : [])
  ];
  return (
    <SoftPanel className="p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No planned time in this period yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row) => {
            const share = totalMinutes === 0 ? 0 : Math.round((row.minutes / totalMinutes) * 100);
            return (
              <div key={row.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-muted">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="shrink-0 font-medium text-ink">{formatDuration(row.minutes)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line/50">
                  <div className="h-full rounded-full transition-all" style={{ width: `${share}%`, backgroundColor: row.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SoftPanel>
  );
}
