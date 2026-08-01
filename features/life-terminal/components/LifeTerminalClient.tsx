"use client";

import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Database,
  Download,
  Gauge,
  ListChecks,
  Microscope
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { IconButton, PrimaryButton } from "@/components/ui";
import type {
  LifeTerminalAllocationRow,
  LifeTerminalData,
  LifeTerminalTask
} from "@/features/life-terminal/domain/lifeTerminal";
import { CalendarCommandCenter } from "./CalendarCommandCenter";
import {
  CollapsibleSection,
  HeaderCell,
  TerminalPanel
} from "./TerminalPanel";

type TaskItem = LifeTerminalTask;
type AllocationPanelRow = LifeTerminalAllocationRow;

const chartFrame = "rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/6";

function formatDateTime(value?: string | null) {
  if (!value) return "none";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

function deltaTone(delta: number, inverted = false) {
  if (delta === 0) return "text-slate-500";
  const good = inverted ? delta < 0 : delta > 0;
  return good ? "text-good" : "text-risk";
}

function badgeTone(value: string) {
  if (["critical", "high", "burnout_risk", "chaotic", "missing"].includes(value)) return "border-risk/50 bg-risk/10 text-risk";
  if (["medium", "pressure", "drift", "partial"].includes(value)) return "border-warn/50 bg-warn/10 text-warn";
  if (["productive", "stable", "complete", "low", "recovery"].includes(value)) return "border-good/45 bg-good/10 text-good";
  return "border-line bg-panel2 text-slate-300";
}

function TopTerminalHeader({ data }: { data: LifeTerminalData }) {
  const header = data.terminalHeader;
  return (
    <div className="rounded-[30px] bg-white/[0.045] p-5 shadow-[0_20px_70px_rgba(2,6,23,0.2)] ring-1 ring-white/8">
      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Life Terminal</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-50">Personal command center</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/daily-log">
            <PrimaryButton>
              <Activity className="h-4 w-4" />
              Daily Log
            </PrimaryButton>
          </Link>
          <Link href="/api/reports/week">
            <IconButton>
              <Download className="h-4 w-4" />
              Weekly JSON
            </IconButton>
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <HeaderCell label="Date" value={header.date} />
        <HeaderCell label="Week" value={header.weekId} />
        <HeaderCell label="Regime" value={header.regime.replace("_", " ")} tone={badgeTone(header.regime).split(" ").at(-1)} />
        <HeaderCell label="Daily Log" value={header.dailyLogStatus} />
        <HeaderCell label="Next High Impact" value={header.nextHighImpactEvent?.title ?? "none"} />
        <HeaderCell label="Health" value={`Risk ${header.risk}`} tone={header.risk === "critical" || header.risk === "high" ? "text-risk" : "text-good"} />
        <HeaderCell label="Phase" value={header.phase.replaceAll("_", " ")} />
      </div>
    </div>
  );
}

function LifeMarketTape({ data }: { data: LifeTerminalData }) {
  return (
    <div className="overflow-hidden rounded-[22px] bg-white/[0.03] ring-1 ring-white/8">
      <div className="flex min-w-max items-center gap-5 px-4 py-3 text-sm text-slate-300">
        {data.lifeTape.items.map((item) => {
          const Icon = item.delta >= 0 ? ArrowUp : ArrowDown;
          return (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="text-slate-500">{item.label.toLowerCase()}</span>
              <span className="font-medium text-slate-50">{item.value ?? "--"}</span>
              <span className={`inline-flex items-center gap-0.5 ${deltaTone(item.delta, item.inverted)}`}>
                <Icon className="h-3 w-3" />
                {item.delta >= 0 ? "+" : ""}
                {item.delta}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Calendar Pressure</span>
          <span className={data.lifeTape.calendarPressureLabel === "HIGH" ? "text-risk" : data.lifeTape.calendarPressureLabel === "MEDIUM" ? "text-warn" : "text-good"}>
            {data.lifeTape.calendarPressureLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function RegimeDetectionPanel({ data }: { data: LifeTerminalData }) {
  const regime = data.regime;
  return (
    <TerminalPanel title="Regime Detection" label="Rule Engine" action={<Gauge className="h-4 w-4 text-accent" />}>
      <div className="grid gap-3 lg:grid-cols-[0.7fr_1fr]">
        <div className="rounded-md border border-line bg-[#090f1a] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Current</p>
          <p className="mt-2 text-2xl font-semibold uppercase text-slate-50">{regime.regime.replace("_", " ")}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-shell">
            <div className="h-full rounded-full bg-accent" style={{ width: `${regime.confidence}%` }} />
          </div>
          <p className="mt-2 font-mono text-xs text-slate-400">CONFIDENCE {regime.confidence}/100</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <span className="rounded border border-line bg-shell px-2 py-1 text-slate-400">LAST {regime.lastRegime?.replace("_", " ") ?? "none"}</span>
            <span className={`rounded border px-2 py-1 ${regime.changed ? "border-warn/50 bg-warn/10 text-warn" : "border-good/40 bg-good/10 text-good"}`}>
              CHANGED {regime.changed ? "YES" : "NO"}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          {regime.why.map((reason) => (
            <div key={reason} className="rounded-md border border-line bg-[#090f1a] px-3 py-2 text-sm text-slate-300">
              {reason}
            </div>
          ))}
        </div>
      </div>
    </TerminalPanel>
  );
}

function ChartPanel({
  title,
  data,
  lines,
  domain = [0, 100]
}: {
  title: string;
  data: LifeTerminalData["trajectory"];
  lines: Array<{ key: string; label: string; color: string }>;
  domain?: [number, number];
}) {
  return (
    <div className={chartFrame}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-200">{title}</h3>
        <BarChart3 className="h-4 w-4 text-slate-500" />
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid stroke="#263349" strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis domain={domain} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #263349", borderRadius: 6, color: "#f8fafc" }} />
            {lines.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
            {lines.map((line) => (
              <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendCurves({ data }: { data: LifeTerminalData }) {
  return (
    <TerminalPanel title="Trend Curves" label="30D Trajectory">
      {!data.enoughForTrend ? (
        <div className="rounded-[20px] bg-warn/10 px-3 py-6 text-center text-sm text-warn ring-1 ring-warn/15">
          Need at least 3 submitted logs to estimate trajectory.
        </div>
      ) : (
        <>
          <div className="grid gap-3 xl:grid-cols-3">
            <ChartPanel title="State Score" data={data.trajectory} lines={[{ key: "stateScore", label: "State", color: "#57c59a" }]} />
            <ChartPanel title="Execution Score" data={data.trajectory} lines={[{ key: "executionScore", label: "Execution", color: "#8da2fb" }]} />
            <ChartPanel title="Risk Score" data={data.trajectory} lines={[{ key: "riskScore", label: "Risk", color: "#f08b8f" }]} />
          </div>
          <CollapsibleSection title="More signals" className="mt-4">
            <div className="grid gap-3 xl:grid-cols-3">
              <ChartPanel
                title="Energy / Productivity / Friction"
                data={data.trajectory}
                lines={[
                  { key: "energy", label: "Energy", color: "#57c59a" },
                  { key: "productivity", label: "Productivity", color: "#76b2ff" },
                  { key: "startFriction", label: "Friction", color: "#f0c56b" }
                ]}
              />
              <ChartPanel title="Calendar Pressure" data={data.trajectory} lines={[{ key: "calendarPressure", label: "Pressure", color: "#8070ff" }]} />
              <ChartPanel title="Todo Completion" data={data.trajectory} lines={[{ key: "todoCompletion", label: "Completion", color: "#8da2fb" }]} />
            </div>
          </CollapsibleSection>
        </>
      )}
    </TerminalPanel>
  );
}

function TaskRow({ task }: { task: TaskItem }) {
  const done = task.status === "done" || task.completionPercent >= 100;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-line/60 py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-100">{task.title}</p>
        <p className="mt-0.5 font-mono text-[11px] uppercase text-slate-500">
          {task.date} | {task.importance} | {task.productive ? "productive" : "non-prod"}
        </p>
      </div>
      <span className={`rounded border px-2 py-1 font-mono text-[11px] uppercase ${done ? "border-good/40 bg-good/10 text-good" : "border-line bg-shell text-slate-400"}`}>
        {task.completionPercent}%
      </span>
    </div>
  );
}

function TaskPanel({ title, tasks }: { title: string; tasks: TaskItem[] }) {
  return (
    <div className="rounded-md border border-line bg-[#090f1a] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-200">{title}</h3>
        <span className="font-mono text-[11px] text-slate-500">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? <p className="py-4 text-sm text-slate-500">No tasks in this section.</p> : tasks.slice(0, 6).map((task) => <TaskRow key={task.id} task={task} />)}
    </div>
  );
}

function TasksTerminalPanel({ data }: { data: LifeTerminalData }) {
  const metrics = data.taskMetrics.week;
  return (
    <TerminalPanel title="Tasks Panel" label="Intentions" action={<ListChecks className="h-4 w-4 text-accent" />}>
      <div className="mb-3 grid gap-2 md:grid-cols-4">
        <HeaderCell label="Weighted Completion" value={pct(metrics.weightedCompletionRate)} />
        <HeaderCell label="Missed High" value={String(metrics.missedImportantTasks)} tone={metrics.missedImportantTasks ? "text-risk" : "text-good"} />
        <HeaderCell label="Planned / Done" value={`${data.taskMetrics.plannedVsDone.planned}/${data.taskMetrics.plannedVsDone.done}`} />
        <HeaderCell label="Productive Completion" value={pct(metrics.productiveTaskCompletion)} />
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <TaskPanel title="Today" tasks={data.taskSections.today} />
        <TaskPanel title="This Week" tasks={data.taskSections.thisWeek} />
        <TaskPanel title="Overdue" tasks={data.taskSections.overdue} />
      </div>
      <CollapsibleSection title="More task slices" className="mt-4">
        <div className="grid gap-3 xl:grid-cols-2">
          <TaskPanel title="High Importance" tasks={data.taskSections.highImportance} />
          <TaskPanel title="Productive Tasks" tasks={data.taskSections.productive} />
        </div>
      </CollapsibleSection>
    </TerminalPanel>
  );
}

function WeeklyPlanner({ data }: { data: LifeTerminalData }) {
  const planner = data.weeklyPlanner;
  return (
    <TerminalPanel title="Weekly To-Do / Week Planner" label="Planning">
      {planner.missingPlanningWarning ? (
        <div className="mb-3 rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
          Missing planning warning: no high-priority weekly priorities detected.
        </div>
      ) : null}
      <div className="mb-3 rounded-md border border-line bg-[#090f1a] p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Week Objective</p>
        <p className="mt-1 text-lg font-semibold text-slate-50">{planner.objective}</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.7fr_1.3fr]">
        <div>
          <h3 className="mb-2 font-mono text-xs font-semibold uppercase text-slate-300">Top 3 Priorities</h3>
          <div className="space-y-2">
            {planner.topPriorities.length === 0 ? <p className="text-sm text-slate-500">No priority set.</p> : planner.topPriorities.map((task) => <TaskRow key={task.id} task={task} />)}
          </div>
          <h3 className="mb-2 mt-4 font-mono text-xs font-semibold uppercase text-slate-300">Major Deadlines / Events</h3>
          <div className="space-y-2">
            {planner.majorEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No major event this week.</p>
            ) : (
              planner.majorEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-line bg-[#090f1a] px-3 py-2 text-sm text-slate-300">
                  <span className="font-semibold text-slate-100">{event.title}</span>
                  <span className="ml-2 text-slate-500">{formatDateTime(event.start)}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-7">
          {planner.tasksByDay.map((day) => (
            <div key={day.date} className="min-h-32 rounded-md border border-line bg-[#090f1a] p-2">
              <p className="mb-2 font-mono text-[11px] font-semibold text-accent">{day.date.slice(5)}</p>
              <div className="space-y-1">
                {day.tasks.slice(0, 4).map((task) => (
                  <p key={task.id} className="truncate rounded bg-shell px-2 py-1 text-xs text-slate-300">
                    {task.title}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TerminalPanel>
  );
}

function DataQualityPanel({ data }: { data: LifeTerminalData }) {
  const quality = data.dataQuality;
  return (
    <TerminalPanel title="Data Quality" label="Coverage" action={<Database className="h-4 w-4 text-accent" />}>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <HeaderCell label="Submitted Logs This Week" value={`${quality.submittedLogsThisWeek}/7`} />
        <HeaderCell label="Missing Days" value={String(quality.missingDays)} tone={quality.missingDays ? "text-warn" : "text-good"} />
        <HeaderCell label="Calendar Events" value={String(quality.calendarEvents)} />
        <HeaderCell label="Tasks Tracked" value={String(quality.tasksTracked)} />
        <HeaderCell label="Enough For Trend" value={quality.enoughDataForTrend ? "yes" : "no"} tone={quality.enoughDataForTrend ? "text-good" : "text-warn"} />
        <HeaderCell label="Enough For Regime" value={quality.enoughDataForRegimeDetection ? "yes" : "no"} tone={quality.enoughDataForRegimeDetection ? "text-good" : "text-warn"} />
      </div>
      {quality.missingDayKeys.length ? <p className="mt-3 font-mono text-xs text-slate-500">Missing: {quality.missingDayKeys.join(", ")}</p> : null}
    </TerminalPanel>
  );
}

function TimeAllocationTerminalPanel({ data }: { data: LifeTerminalData }) {
  const allocation = data.timeAllocation;
  const pieData = allocation.rows
    .filter((row: AllocationPanelRow) => row.targetWeight > 0)
    .map((row: AllocationPanelRow) => ({ name: row.name, value: row.targetWeight, color: row.color }));

  return (
    <TerminalPanel
      title="Time Allocation"
      label="Portfolio"
      action={
        <Link href="/time-allocation" className="text-xs font-semibold text-accent underline">
          Open
        </Link>
      }
    >
      <div className="grid gap-2 md:grid-cols-4">
        <HeaderCell label="Day Budget" value={formatMinutes(allocation.dayBudgetMinutes)} />
        <HeaderCell label="Planned Today" value={formatMinutes(allocation.plannedMinutesTotal)} />
        <HeaderCell label="Logged Today" value={formatMinutes(allocation.actualMinutesTotal)} />
        <HeaderCell label="Blocks" value={String(allocation.rows.length)} tone={allocation.targetWeightTotal === 100 ? "text-good" : "text-warn"} />
      </div>
      {allocation.rows.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-line bg-[#090f1a] px-3 py-8 text-center text-sm text-slate-500">
          No time allocation yet. Build your portfolio from the Time Allocation page.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="h-48 rounded-md border border-line bg-[#090f1a] p-2">
            {pieData.length === 0 ? (
              <div className="grid h-full place-items-center text-center text-sm text-slate-500">No target percentages yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={2}>
                    {pieData.map((entry: { name: string; value: number; color: string }) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value}%`, name]}
                    contentStyle={{ background: "#0b1220", border: "1px solid #263349", borderRadius: 6, color: "#f8fafc" }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-2">
            {allocation.rows.slice(0, 6).map((row: AllocationPanelRow) => (
              <div key={row.id} className="rounded-md border border-line bg-[#090f1a] p-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-100">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="font-mono text-xs text-slate-300">{row.targetWeight}% target / {row.actualWeight}% real</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-shell">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, row.targetWeight))}%` }} />
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span>{formatMinutes(row.plannedMinutes)} planned</span>
                  <span>{row.plannedMinutesManual ? "manual" : `${formatMinutes(row.autoPlannedMinutes)} auto`}</span>
                </div>
                {row.objective ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{row.objective}</p> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </TerminalPanel>
  );
}

function QuantLab({ data }: { data: LifeTerminalData }) {
  return (
    <TerminalPanel title="Quant Lab" label="Placeholder" action={<Microscope className="h-4 w-4 text-accent" />}>
      <div className="grid gap-3 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-md border border-line bg-[#090f1a] p-3">
          <h3 className="font-mono text-xs font-semibold uppercase text-slate-300">Projected Next 7 Days</h3>
          <div className="mt-3 space-y-2">
            {data.quant.projection.slice(0, 5).map((item) => (
              <div key={item.regime}>
                <div className="mb-1 flex justify-between font-mono text-xs uppercase text-slate-400">
                  <span>{item.regime.replace("_", " ")}</span>
                  <span>{item.probability}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-shell">
                  <div className="h-full rounded-full bg-violet" style={{ width: `${item.probability}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border border-line bg-[#090f1a] p-3">
          <h3 className="mb-3 font-mono text-xs font-semibold uppercase text-slate-300">Regime Transition Matrix Placeholder</h3>
          <table className="w-full min-w-[620px] border-collapse font-mono text-[11px] text-slate-400">
            <thead>
              <tr>
                <th className="border-b border-line p-1 text-left">from</th>
                {Object.keys(data.quant.transitionMatrix[0]?.probabilities ?? {}).map((key) => (
                  <th key={key} className="border-b border-line p-1 text-right">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.quant.transitionMatrix.map((row) => (
                <tr key={row.from} className={row.active ? "bg-accent/5 text-accent" : ""}>
                  <td className="border-b border-line/60 p-1">{row.from}</td>
                  {Object.entries(row.probabilities).map(([key, value]) => (
                    <td key={key} className="border-b border-line/60 p-1 text-right">{value}%</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Monte Carlo and HMM are not implemented yet. These probabilities are heuristic outputs from the placeholder service.
      </p>
    </TerminalPanel>
  );
}

export function LifeTerminalClient({ data }: { data: LifeTerminalData }) {
  return (
    <div className="life-terminal space-y-4">
      <TopTerminalHeader data={data} />
      <LifeMarketTape data={data} />
      <TrendCurves data={data} />
      <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr]">
        <RegimeDetectionPanel data={data} />
        <TimeAllocationTerminalPanel data={data} />
      </div>
      <div className="grid gap-3 2xl:grid-cols-[1.2fr_0.8fr]">
        <CalendarCommandCenter initialEvents={data.initialEvents} />
        <TasksTerminalPanel data={data} />
      </div>
      <CollapsibleSection title="Planning and system details" defaultOpen={false}>
        <div className="space-y-3">
          <DataQualityPanel data={data} />
          <WeeklyPlanner data={data} />
          <QuantLab data={data} />
          <div className="rounded-[18px] bg-white/[0.03] px-4 py-3 text-sm text-slate-400 ring-1 ring-white/6">
            Weekly export route: <Link className="text-accent underline" href={`/api/reports/week?week_id=${data.weekId}`}>/api/reports/week?week_id={data.weekId}</Link>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
