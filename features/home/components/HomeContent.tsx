"use client";

import Link from "next/link";
import { Activity, CalendarPlus, FolderKanban, ListPlus, MonitorCog, NotebookPen, PieChart, Repeat2 } from "lucide-react";
import { TrajectoryCharts } from "@/components/TrajectoryCharts";
import { Metric, Panel, PrimaryButton } from "@/components/ui";
import { formatDisplayDate } from "@/lib/dates";
import { PerformanceStrip } from "@/features/performance/components/PerformanceStrip";


import type { LifeTerminalData } from "@/features/life-terminal/domain/lifeTerminal";

export function HomeContent({ data }: { data: LifeTerminalData }) {
  const mainTask =
    data.taskSections.highImportance[0] ??
    data.taskSections.today.find((task) => task.status !== "done") ??
    data.taskSections.today[0];
  const nextEvent = data.terminalHeader.nextHighImpactEvent;

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">{formatDisplayDate(data.today)}</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-50">Life Regime</h1>
          <p className="mt-2 text-sm text-slate-400">A lighter readout of the terminal state.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/life-terminal">
            <PrimaryButton>
              <MonitorCog className="h-4 w-4" />
              Open Life Terminal
            </PrimaryButton>
          </Link>
          <Link href="/todo">
            <span className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/[0.04] px-4 text-sm font-medium text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.07]">
              <ListPlus className="h-4 w-4" />
              Add task
            </span>
          </Link>
          <Link href="/objectives">
            <span className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/[0.04] px-4 text-sm font-medium text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.07]">
              <FolderKanban className="h-4 w-4" />
              Objectives
            </span>
          </Link>
          <Link href="/calendar">
            <span className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/[0.04] px-4 text-sm font-medium text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.07]">
              <CalendarPlus className="h-4 w-4" />
              Add event
            </span>
          </Link>
          <Link href="/daily-log">
            <span className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/[0.04] px-4 text-sm font-medium text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.07]">
              <NotebookPen className="h-4 w-4" />
              Daily Log
            </span>
          </Link>
          <Link href="/time-allocation">
            <span className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/[0.04] px-4 text-sm font-medium text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.07]">
              <PieChart className="h-4 w-4" />
              Time Allocation
            </span>
          </Link>
          <Link href="/habits">
            <span className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/[0.04] px-4 text-sm font-medium text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.07]">
              <Repeat2 className="h-4 w-4" />
              Habits
            </span>
          </Link>
        </div>
      </div>

      <div className="mb-4"><PerformanceStrip /></div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <p className="text-xs font-semibold uppercase text-accent">Current regime</p>
          <div className="mt-3 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold uppercase text-slate-50">{data.regime.regime.replace("_", " ")}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">{data.regime.why[0]}</p>
            </div>
            <div className="rounded-md border border-line bg-shell px-3 py-2 font-mono text-sm text-slate-300">
              CONF {data.regime.confidence}/100
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric label="Risk" value={data.terminalHeader.risk} tone={data.terminalHeader.risk === "high" || data.terminalHeader.risk === "critical" ? "risk" : "good"} />
            <Metric label="Daily log" value={data.terminalHeader.dailyLogStatus} />
            <Metric label="Phase" value={data.terminalHeader.phase.replaceAll("_", " ")} />
            <Metric label="Data" value={data.terminalHeader.dataQuality} />
          </div>
        </Panel>

        <Panel>
          <p className="text-xs font-semibold uppercase text-accent">Today</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">{mainTask?.title ?? "No main task planned"}</h2>
          <p className="mt-2 text-sm text-slate-400">
            Next high-impact event: {nextEvent ? `${nextEvent.title} at ${new Date(nextEvent.start).toLocaleString()}` : "none"}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Week completion" value={`${Math.round(data.taskMetrics.week.weightedCompletionRate * 100)}%`} />
            <Metric label="Day budget" value={data.timeAllocation ? `${Math.round(data.timeAllocation.dayBudgetMinutes / 60)}h` : "--"} />
            <Metric label="Missing logs" value={String(data.dataQuality.missingDays)} tone={data.dataQuality.missingDays ? "warn" : "good"} />
            <Metric label="Planned today" value={`${Math.round(data.timeAllocation.plannedMinutesTotal / 60)}h`} />
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        {data.enoughForTrend ? (
          <TrajectoryCharts data={data.trajectory} compact />
        ) : (
          <Panel>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <Activity className="h-4 w-4 text-accent" />
              Need at least 3 submitted logs to estimate mini trend.
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
