import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TrajectoryCharts } from "@/components/TrajectoryCharts";
import { Metric, Panel, PrimaryButton } from "@/components/ui";
import { parseLifeTerminalData } from "@/features/life-terminal/api/lifeTerminalApi";
import { requireUser } from "@/lib/auth";
import { requestInternalApiJson } from "@/lib/server/internalApiClient";

export default async function LifeDashboardPage() {
  await requireUser();
  const data = await requestInternalApiJson(
    "/api/life-terminal",
    parseLifeTerminalData
  );
  const tapeValues = new Map(data.lifeTape.items.map((item) => [item.label, item.value]));
  const todayLog = {
    stateScore: tapeValues.get("STATE") ?? null,
    riskScore: tapeValues.get("RISK") ?? null,
    executionScore: tapeValues.get("EXECUTION") ?? null,
    startFriction: data.quickLog.startFriction,
    status: data.quickLog.status
  };
  const calendar = data.calendarContext;
  const nextEvent = data.terminalHeader.nextHighImpactEvent;
  const weeklySummary = data.weeklySummary;

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">Life Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-50">Trajectory</h1>
          <p className="mt-2 text-sm text-slate-400">State, risk, execution, and external pressure over time.</p>
        </div>
        <Link href="/daily-log">
          <PrimaryButton>
            Open daily log
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </Link>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Metric label="State today" value={String(todayLog?.stateScore ?? "--")} tone="good" />
        <Metric label="Risk today" value={String(todayLog?.riskScore ?? "--")} tone="warn" />
        <Metric label="Execution today" value={String(todayLog.executionScore ?? "--")} />
        <Metric label="Start friction" value={String(todayLog.startFriction)} tone="risk" />
        <Metric label="Log status" value={todayLog.status} />
        <Metric label="Weekly completion" value={`${Math.round((weeklySummary.avgExecutionScore ?? 0))}%`} />
        <Metric label="Calendar phase" value={calendar.activePhase.replaceAll("_", " ")} />
        <Metric label="High-impact next" value={nextEvent?.title ?? "none"} tone={nextEvent ? "risk" : "neutral"} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Panel>
          <div className="mb-4 flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Weekly trajectory</h2>
              <p className="text-sm text-slate-400">{weeklySummary.period.start} to {weeklySummary.period.end}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Avg state" value={String(weeklySummary.avgStateScore ?? "--")} tone="good" />
            <Metric label="Avg risk" value={String(weeklySummary.avgRiskScore ?? "--")} tone="warn" />
            <Metric label="Avg execution" value={String(weeklySummary.avgExecutionScore ?? "--")} />
            <Metric label="Avg friction" value={String(weeklySummary.avgStartFriction ?? "--")} tone="risk" />
            <Metric label="Submitted" value={String(weeklySummary.submittedLogs)} />
            <Metric label="Missing" value={String(weeklySummary.missingDays)} tone="risk" />
            <Metric label="Skipped" value={String(weeklySummary.skippedDays)} />
            <Metric label="Training" value={String(weeklySummary.trainingDays)} tone="good" />
          </div>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase text-accent">Rule-based interpretation</p>
          <div className="mt-3 space-y-2">
            {data.interpretation.map((message) => (
              <p key={message} className="rounded-md border border-line bg-shell px-3 py-2 text-sm text-slate-300">
                {message}
              </p>
            ))}
          </div>
        </Panel>
      </div>

      <TrajectoryCharts data={data.trajectory} />
    </AppShell>
  );
}
