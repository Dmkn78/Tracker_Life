import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TrajectoryCharts } from "@/components/TrajectoryCharts";
import { Metric, Panel, PrimaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getIsoWeekId, parseDateKey, toDateKey } from "@/lib/dates";
import { buildInterpretationMessages, computeWeeklySummary, getTrajectory, serializeCalendarEvent } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { getCalendarContext, getNextHighImpactEvent, getTodoMetrics } from "@/lib/todoMetrics";

export default async function LifeDashboardPage() {
  const user = await requireUser();
  const today = toDateKey();
  const weekId = getIsoWeekId(today);
  const [todayLog, todo, calendar, nextHighImpactEvent, trajectory, weeklySummary, weekLogs, lastWeekSummary] =
    await Promise.all([
      prisma.dailyLog.findUnique({ where: { userId_date: { userId: user.id, date: parseDateKey(today) } } }),
      getTodoMetrics(user.id, today),
      getCalendarContext(user.id, today),
      getNextHighImpactEvent(user.id, today),
      getTrajectory(user.id, 30, today),
      computeWeeklySummary(user.id, weekId),
      prisma.dailyLog.findMany({
        where: { userId: user.id, date: { gte: parseDateKey(today.slice(0, 8) + "01") } },
        orderBy: { date: "asc" }
      }),
      computeWeeklySummary(user.id, getIsoWeekId(new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)))
    ]);
  const interpretation = buildInterpretationMessages({
    logs: weekLogs,
    weeklySummary,
    calendarContext: calendar,
    executionImproved:
      weeklySummary.avgExecutionScore != null &&
      lastWeekSummary.avgExecutionScore != null &&
      weeklySummary.avgExecutionScore > lastWeekSummary.avgExecutionScore
  });
  const nextEvent = serializeCalendarEvent(nextHighImpactEvent);

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
        <Metric label="Execution today" value={String(todayLog?.executionScore ?? Math.round(todo.metrics.weightedCompletionRate * 100))} />
        <Metric label="Start friction" value={String(todayLog?.startFriction ?? "--")} tone="risk" />
        <Metric label="Log status" value={(todayLog?.status ?? "MISSING").toLowerCase()} />
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
            {interpretation.map((message) => (
              <p key={message} className="rounded-md border border-line bg-shell px-3 py-2 text-sm text-slate-300">
                {message}
              </p>
            ))}
          </div>
        </Panel>
      </div>

      <TrajectoryCharts data={trajectory} />
    </AppShell>
  );
}
