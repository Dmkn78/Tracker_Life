"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/components/DurationInput";
import { Metric, SoftPanel } from "@/components/ui";
import { loadTaskTimeBreakdown } from "@/features/time-allocation/api/timeAllocationApi";
import type {
  TaskTimeBreakdown,
  TaskTimeBreakdownEntry,
  TaskTimeBreakdownPeriod
} from "@/features/time-allocation/domain/timeAllocation";
import type { TimeAllocationPeriod } from "@/features/time-allocation/domain/allocationPeriod";
import { ApiError } from "@/lib/http/apiClient";
import { useLocale } from "@/features/interface/localization/LocaleProvider";

export function TaskTimeBreakdownPanel({
  date,
  period,
  refreshVersion
}: {
  date: string;
  period: TimeAllocationPeriod;
  refreshVersion: number;
}) {
  const { locale } = useLocale();
  const copy = TASK_BREAKDOWN_COPY[locale];
  const taskPeriod: TaskTimeBreakdownPeriod = period === "month" ? "month" : "week";
  const [data, setData] = useState<TaskTimeBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestController = new AbortController();
    setError(null);
    void loadTaskTimeBreakdown(taskPeriod, date, requestController.signal)
      .then(setData)
      .catch((loadError: unknown) => {
        if (!requestController.signal.aborted) {
          setError(loadError instanceof ApiError ? loadError.message : copy.loadError);
        }
      });
    return () => requestController.abort();
  }, [copy.loadError, taskPeriod, date, refreshVersion]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{copy.detail}</p>
        <span className="rounded-full bg-line/40 px-3 py-1 text-xs font-medium text-muted">
          {taskPeriod === "week" ? copy.thisWeek : copy.thisMonth}
        </span>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-risk/10 px-4 py-3 text-sm text-risk ring-1 ring-risk/15">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={copy.totalPlanned} value={formatDuration(data.totalMinutes)} detail={`${data.taskCount} ${data.taskCount === 1 ? copy.task : copy.tasks}`} />
            <Metric
              label={data.period === "week" ? copy.week : copy.month}
              value={`${data.rangeStart} → ${data.rangeEnd}`}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownList
              title={copy.byCompany}
              entries={data.byCompany}
              unassignedLabel={copy.noCompany}
              unassignedMinutes={data.noCompanyMinutes}
              totalMinutes={data.totalMinutes}
            />
            <BreakdownList
              title={copy.byTag}
              entries={data.byTag}
              unassignedLabel={copy.noTag}
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
  const { locale } = useLocale();
  const copy = TASK_BREAKDOWN_COPY[locale];
  const rows = [
    ...entries,
    ...(unassignedMinutes > 0 ? [{ id: "__unassigned", name: unassignedLabel, color: "#5b6577", minutes: unassignedMinutes }] : [])
  ];
  return (
    <SoftPanel className="p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{copy.empty}</p>
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

const TASK_BREAKDOWN_COPY = {
  en: {
    detail: "Time from task estimates, grouped by tag and by company.", thisWeek: "This week", thisMonth: "This month",
    totalPlanned: "Total planned", task: "task", tasks: "tasks", week: "Week", month: "Month", byCompany: "By company",
    noCompany: "No company", byTag: "By tag", noTag: "No tag", empty: "No planned time in this period yet.",
    loadError: "Unable to load the task time breakdown."
  },
  fr: {
    detail: "Temps estimé des tâches, regroupé par étiquette et par entreprise.", thisWeek: "Cette semaine", thisMonth: "Ce mois",
    totalPlanned: "Total planifié", task: "tâche", tasks: "tâches", week: "Semaine", month: "Mois", byCompany: "Par entreprise",
    noCompany: "Sans entreprise", byTag: "Par étiquette", noTag: "Sans étiquette", empty: "Aucun temps planifié sur cette période.",
    loadError: "Impossible de charger la répartition du temps par tâche."
  }
} as const;
