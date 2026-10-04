"use client";

import Link from "next/link";
import { Metric, Panel } from "@/components/ui";
import { WeeklyExportButton } from "@/components/WeeklyExportButton";
import { getIsoWeekId } from "@/lib/dates";


import type { HistoryData } from "@/features/history/domain/history";

export function HistoryContent({ data }: { data: HistoryData }) {
  const filter = data.filter;
  const byDate = new Map(data.logs.map((log) => [log.date, log]));
  const grouped = data.visibleDates.reduce<Record<string, string[]>>((acc, date) => {
    const week = getIsoWeekId(date);
    acc[week] = acc[week] ?? [];
    acc[week].push(date);
    return acc;
  }, {});
  const weeklySummary = data.weeklySummary;

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">Review</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-50">History</h1>
        </div>
        <WeeklyExportButton />
      </div>

      <Panel className="mb-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            ["last7", "last 7 days"],
            ["last30", "last 30 days"],
            ["week", "current week"],
            ["all", "all"]
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/history?filter=${key}`}
              className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${
                filter === key ? "border-accent bg-accent/10 text-accent" : "border-line bg-shell text-slate-300"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Metric label="Week state" value={String(weeklySummary.avgStateScore ?? "--")} tone="good" />
          <Metric label="Week risk" value={String(weeklySummary.avgRiskScore ?? "--")} tone="warn" />
          <Metric label="Submitted" value={String(weeklySummary.submittedLogs)} />
          <Metric label="Missing" value={String(weeklySummary.missingDays)} tone="risk" />
          <Metric label="Phase" value={weeklySummary.activePhase.replaceAll("_", " ")} />
        </div>
      </Panel>

      <div className="space-y-5">
        {Object.entries(grouped).map(([week, weekDates]) => (
          <section key={week}>
            <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">{week}</h2>
            <div className="space-y-3">
              {weekDates.map((date) => {
                const log = byDate.get(date);
                return (
                  <Link key={date} href={`/daily-log?date=${date}`}>
                    <Panel className="transition hover:border-accent/60 hover:bg-panel2/70">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-slate-50">{date}</h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {log?.status ?? "missing"}
                            {log ? ` · updated ${new Date(log.updatedAt).toLocaleString()}` : ""}
                          </p>
                        </div>
                        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
                          <Metric label="Energy" value={String(log?.energy ?? "--")} />
                          <Metric label="Productivity" value={String(log?.productivity ?? "--")} />
                          <Metric label="Execution" value={String(log?.executionScore ?? "--")} />
                          <Metric label="State" value={String(log?.stateScore ?? "--")} tone="good" />
                          <Metric label="Risk" value={String(log?.riskScore ?? "--")} tone="warn" />
                          <Metric label="Status" value={log?.status ?? "missing"} />
                        </div>
                      </div>
                    </Panel>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
