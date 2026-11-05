"use client";

import Link from "next/link";
import { Download, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Card, Drawer, FieldLabel, Metric, Pill, PrimaryButton, ProgressBar, SecondaryButton, SectionHeader, Segmented, SegmentedButton, SelectInput, TextInput } from "@/components/ui";
import { loadPerformance, savePerformance } from "../api/performanceApi";
import { createPerformanceProfile, formatCapital, formatWorkTime, type PerformanceData, type ExecutionStatus } from "../domain/performance";
import { BlockExecutionForm } from "./BlockExecutionForm";

type DrawerState = "work" | "target" | "profile" | null;
type PerformanceTab = "overview" | "rewards" | "history";

export function PerformanceClient() {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [tab, setTab] = useState<PerformanceTab>("overview");
  const [targetHours, setTargetHours] = useState("40");
  const [session, setSession] = useState({ title: "", date: "", actualMinutes: "60", objectiveId: "" });
  const [editingSession, setEditingSession] = useState<PerformanceData["recentSessions"][number] | null>(null);
  const controller = useRef<AbortController | null>(null);
  const sessionRequest = useRef({ id: "", payload: "" });

  useEffect(() => {
    const initial = new AbortController();
    controller.current = initial;
    void loadPerformance(initial.signal).then(setPerformance).catch((cause: unknown) => {
      if (!initial.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load performance");
    });
    return () => controller.current?.abort();
  }, []);

  async function refresh() {
    if (busy) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try { setPerformance(await loadPerformance(request.signal)); }
    catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to refresh"); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }

  function openDrawer(next: DrawerState) {
    setError("");
    if (next === "target" && performance) setTargetHours(String(performance.targetMinutes / 60));
    if (next === "work" && performance) setSession((current) => ({ ...current, date: current.date || performance.today }));
    setDrawer(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (drawer !== "work" && drawer !== "target")) return;
    const path = drawer;
    const workPayload = { ...session, actualMinutes: Number(session.actualMinutes), objectiveId: session.objectiveId || null };
    const serialized = JSON.stringify(workPayload);
    if (path === "work" && sessionRequest.current.payload !== serialized) {
      sessionRequest.current = { id: crypto.randomUUID(), payload: serialized };
    }
    const payload = path === "work" ? { ...workPayload, requestId: sessionRequest.current.id } : { targetMinutes: Math.round(Number(targetHours) * 60) };
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const result = await savePerformance(path, payload, request.signal);
      setPerformance(result); setDrawer(null);
      if (path === "work") { sessionRequest.current = { id: "", payload: "" }; setSession({ title: "", date: result.today, actualMinutes: "60", objectiveId: "" }); }
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to save"); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }

  return <div className="space-y-6">
    <SectionHeader eyebrow="Performance / Execution" title="Performance" detail="Track focused work, delivered objectives, and your weekly trajectory."
      action={<><PrimaryButton disabled={!performance || busy} onClick={() => openDrawer("work")}><Plus className="h-4 w-4" />Log work</PrimaryButton>
        <SecondaryButton disabled={!performance || busy} onClick={() => openDrawer("profile")}><Download className="h-4 w-4" />Performance profile</SecondaryButton></>} />
    {error && !drawer ? <p role="alert" className="rounded-2xl bg-risk/10 p-4 text-sm text-risk">{error} <button className="underline" onClick={() => void refresh()}>Retry</button></p> : null}
    {!performance && !error ? <Card><p role="status" className="text-sm text-muted">Loading your work record…</p></Card> : null}
    {performance ? <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Performance index" value={`${performance.index} / 100`} detail="This week · to date" />
        <Metric label="Capital generated" value={formatCapital(performance.week.capitalCents)} detail={`Today ${formatCapital(performance.daily.capitalCents)} · fictional value`} />
        <Metric label="Focused work" value={formatWorkTime(performance.week.focusMinutes)} detail={`Today ${formatWorkTime(performance.daily.focusMinutes)} · recorded sessions`} />
        <Metric label="Current streak" value={`${performance.streak} days`} detail={`${performance.week.productiveDays} productive days this week`} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented aria-label="Performance view">{(["overview", "rewards", "history"] as const).map((name) => <SegmentedButton key={name} active={tab === name} onClick={() => setTab(name)}>{name === "overview" ? "Overview" : name === "rewards" ? "Rewards" : "History"}</SegmentedButton>)}</Segmented>
        <div className="flex flex-wrap items-center gap-3"><p className="text-xs text-muted">{performance.today} · Current week</p><SecondaryButton disabled={busy} onClick={() => void refresh()} aria-label="Refresh performance"><RefreshCw className="h-4 w-4" />Refresh</SecondaryButton></div>
      </div>
      {tab === "overview" ? <>
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-muted">Execution / this week</p><h2 className="mt-2 text-xl font-semibold text-ink">Weekly target</h2></div>
              <SecondaryButton onClick={() => openDrawer("target")}><SlidersHorizontal className="h-4 w-4" />Adjust</SecondaryButton></div>
            <div className="mt-5 flex flex-wrap items-baseline gap-2"><span className="text-3xl font-semibold tabular-nums text-ink">{formatWorkTime(performance.week.minutes)}</span><span className="text-muted">/ {formatWorkTime(performance.targetMinutes)}</span></div>
            <ProgressBar className="mt-4" value={performance.week.minutes / performance.targetMinutes * 100} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label={performance.gapMinutes < 0 ? "Behind trajectory" : "Ahead of trajectory"} value={`${performance.gapMinutes < 0 ? "−" : "+"}${formatWorkTime(performance.gapMinutes)}`} tone={performance.gapMinutes < 0 ? "warn" : "neutral"} />
              <Metric label="Remaining" value={formatWorkTime(performance.remainingMinutes)} />
              <Metric label="Required pace" value={`${formatWorkTime(performance.requiredDailyMinutes)}/day`} />
            </div>
            <p className="mt-3 text-xs text-muted">Expected by end of today: {formatWorkTime(performance.expectedMinutes)}. Pace includes today and the remaining calendar days.</p>
            {performance.requiredDailyMinutes > 1440 ? <p className="mt-2 text-xs text-warn">The required pace exceeds 24h/day. Adjust the target to make the remaining plan feasible.</p> : null}
            <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4 text-sm"><Link className="text-accent" href="/objectives/planning">Plan or log a work block →</Link><Link className="text-accent" href="/todo">Complete priority tasks →</Link></div>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-muted">Performance status</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{performance.status}</h2>
            <p className="mt-2 text-sm text-muted">Your cumulative record of output and consistency.</p>
            <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Accumulated capital" value={formatCapital(performance.total.capitalCents)} /><Metric label="Productive days" value={String(performance.total.productiveDays)} /></div>
            <div className="mt-5 flex justify-between gap-3 text-sm text-ink"><span>{performance.nextStatus ? `Next: ${performance.nextStatus}` : "Highest status reached"}</span><span>{performance.statusProgress}%</span></div>
            <ProgressBar className="mt-3" value={performance.statusProgress} />
            {performance.nextStatus ? <p className="mt-3 text-xs text-muted">Requires both {formatCapital(performance.nextCapitalCents)} accumulated value and {performance.nextProductiveDays} productive days.</p> : null}
            <p className="mt-5 text-xs leading-relaxed text-muted">Foundation → Established → Proven → Distinguished → Principal</p>
          </Card>
        </div>
        <Card><h2 className="text-lg font-semibold text-ink">Output & momentum</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Tasks completed" value={String(performance.week.tasks)} detail={`${performance.daily.tasks} today · productive tasks only`} />
            <Metric label="Objectives delivered" value={String(performance.week.objectives)} detail={`${performance.total.objectives} recorded all time`} />
            <Metric label="Value vs last week" value={`${performance.week.capitalCents >= performance.previousWeek.capitalCents ? "+" : "−"}${formatCapital(Math.abs(performance.week.capitalCents - performance.previousWeek.capitalCents))}`} detail="Same elapsed weekdays" />
            <Metric label="This month" value={formatCapital(performance.month.capitalCents)} detail={`${formatWorkTime(performance.month.minutes)} productive work`} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">{[["Focus", performance.focusScore], ["Execution", performance.execution], ["Consistency", performance.consistency]].map(([label, score]) => <div key={String(label)}><div className="mb-2 flex justify-between text-sm text-muted"><span>{label}</span><span>{score === null ? "No planned tasks" : `${score}%`}</span></div><ProgressBar value={typeof score === "number" ? score : 0} /></div>)}</div>
        </Card>
        <Card><h2 className="text-lg font-semibold text-ink">Recent focused work</h2><p className="mt-1 text-sm text-muted">The latest 20 work / study sessions. Correct an entry to recalculate its value.</p>
          <div className="mt-4 divide-y divide-line">{performance.recentSessions.length ? performance.recentSessions.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium text-ink">{entry.title}</p><p className="text-xs text-muted">{entry.date} · {entry.executionStatus}</p></div><div className="flex items-center gap-3"><span className="text-sm tabular-nums text-ink">{formatWorkTime(entry.actualMinutes)}</span><SecondaryButton onClick={() => setEditingSession(entry)}>Correct</SecondaryButton></div></div>) : <p className="py-5 text-sm text-muted">No sessions recorded. Log focused work or record actual minutes on an existing objective block.</p>}</div>
        </Card>
      </> : tab === "rewards" ? <PerformanceRewards performance={performance} /> : <PerformanceHistory performance={performance} />}
      {performance.undatedCompletions > 0 ? <p className="text-xs text-muted">{performance.undatedCompletions} older completions have no recorded completion date. They remain in your tasks and objectives but are excluded from dated performance and rewards.</p> : null}
      <PerformanceRules policy={performance.rewardPolicy} />
    </> : null}
    <Drawer open={drawer !== null} title={drawer === "work" ? "Log focused work" : drawer === "target" ? "Weekly target" : "Performance profile"} onClose={() => { if (!busy) setDrawer(null); }}>
      {error ? <p role="alert" className="mb-4 text-sm text-risk">{error}</p> : null}
      {drawer === "profile" && performance ? <ProfileExport performance={performance} /> : <form onSubmit={submit} className="space-y-4">
        {drawer === "target" ? <><FieldLabel htmlFor="weekly-hours">Productive hours per week</FieldLabel><TextInput id="weekly-hours" type="number" min={1} max={168} step={0.5} value={targetHours} onChange={(event) => setTargetHours(event.target.value)} required /><p className="text-sm text-muted">Applies to the current week. Past targets stay unchanged. New weeks start at 40 hours unless adjusted.</p></> : <>
          <div><FieldLabel htmlFor="work-title">What did you produce?</FieldLabel><TextInput id="work-title" className="mt-2" required maxLength={200} value={session.title} onChange={(event) => setSession({ ...session, title: event.target.value })} placeholder="Research synthesis, implementation, analysis…" /></div>
          <div className="grid grid-cols-2 gap-3"><div><FieldLabel htmlFor="work-date">Date</FieldLabel><TextInput id="work-date" className="mt-2" type="date" max={performance?.today} required value={session.date} onChange={(event) => setSession({ ...session, date: event.target.value })} /></div>
            <div><FieldLabel htmlFor="work-minutes">Actual minutes</FieldLabel><TextInput id="work-minutes" className="mt-2" type="number" min={1} max={1440} required value={session.actualMinutes} onChange={(event) => setSession({ ...session, actualMinutes: event.target.value })} /></div></div>
          <div><FieldLabel htmlFor="work-objective">Objective · optional</FieldLabel><SelectInput id="work-objective" className="mt-2" value={session.objectiveId} onChange={(event) => setSession({ ...session, objectiveId: event.target.value })}><option value="">Independent session</option>{performance?.objectiveOptions.map((objective) => <option key={objective.id} value={objective.id}>{objective.title}</option>)}</SelectInput></div>
          <p className="text-sm text-muted">Record time actually worked. If this session already exists in Objectives, log that block instead.</p>
        </>}
        <PrimaryButton type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</PrimaryButton>
      </form>}
    </Drawer>
    <Drawer open={editingSession !== null} title="Correct focused work" onClose={() => setEditingSession(null)}>
      {editingSession ? <BlockExecutionForm key={editingSession.id} block={{ ...editingSession, executionStatus: editingSession.executionStatus as ExecutionStatus }} onSaved={() => { setEditingSession(null); void refresh(); }} /> : null}
    </Drawer>
  </div>;
}

function PerformanceRewards({ performance }: { performance: PerformanceData }) {
  return <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-ink">Rewards ledger</h2><p className="mt-1 text-sm text-muted">Latest 50 credits, each tied to recorded work. Corrections recalculate the ledger.</p></div><Pill>Fictional value · no cash value</Pill></div>
    <div className="mt-5 divide-y divide-line">{performance.rewards.length ? performance.rewards.map((reward) => <div key={reward.id} className="flex items-start justify-between gap-4 py-4"><div><p className="text-sm font-medium text-ink">{reward.title}</p><p className="mt-1 text-xs text-muted">{reward.date} · {reward.reason}</p></div><p className="shrink-0 text-lg font-semibold tabular-nums text-ink">+{formatCapital(reward.capitalCents)}</p></div>) : <p className="py-8 text-sm text-muted">Your ledger starts with your first recorded work session or completed task. Planned work alone earns no value.</p>}</div>
  </Card>;
}

function PerformanceHistory({ performance }: { performance: PerformanceData }) {
  return <div className="space-y-4"><Card><h2 className="text-xl font-semibold text-ink">Eight-week trajectory</h2><p className="mt-1 text-sm text-muted">Actual work against each week’s target. The current week is in progress.</p>
    <div className="mt-6 grid grid-cols-8 items-end gap-2" aria-label="Weekly productive work in hours">{performance.history.map((week) => <div key={week.start} className="flex flex-col items-center gap-2"><span className="text-[10px] tabular-nums text-muted">{Math.round(week.minutes / 60)}h</span><div className="flex h-28 w-full items-end rounded-xl bg-panel2"><div className="w-full rounded-xl bg-accent/70" style={{ height: `${Math.min(100, week.minutes / Math.max(...performance.history.map((row) => row.minutes), 1) * 100)}%` }} /></div><span className="text-[10px] text-muted">{week.start.slice(5)}</span></div>)}</div>
    <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Weekly performance history</caption><thead className="text-xs text-muted"><tr>{["Week of", "Productive / target", "Output", "Value"].map((title) => <th key={title} className="whitespace-nowrap px-2 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y divide-line">{performance.history.toReversed().map((week) => <tr key={week.start}><td className="whitespace-nowrap px-2 py-3 text-ink">{week.start}</td><td className="whitespace-nowrap px-2 text-muted">{formatWorkTime(week.minutes)} / {formatWorkTime(week.targetMinutes)}</td><td className="whitespace-nowrap px-2 text-muted">{week.tasks} tasks · {week.objectives} objectives</td><td className="whitespace-nowrap px-2 font-medium text-ink">{formatCapital(week.capitalCents)}</td></tr>)}</tbody></table></div>
  </Card><Card><h2 className="text-xl font-semibold text-ink">Monthly record</h2><p className="mt-1 text-sm text-muted">Six calendar months. The current month is in progress.</p><div className="mt-4 divide-y divide-line">{performance.monthlyHistory.toReversed().map((month) => <div key={month.start} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span className="font-medium text-ink">{month.start.slice(0, 7)}</span><span className="text-muted">{formatWorkTime(month.minutes)} · {month.tasks} tasks · {month.objectives} objectives</span><span className="font-semibold text-ink">{formatCapital(month.capitalCents)}</span></div>)}</div></Card></div>;
}

function PerformanceRules({ policy }: { policy: PerformanceData["rewardPolicy"] }) {
  return <Card><details><summary className="cursor-pointer text-sm font-semibold text-ink">How value and performance are calculated</summary><div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
    <p>Productive work: {formatCapital(policy.hourlyCents)}/h. For each day, the higher of submitted Daily Log work minutes and recorded work / study block minutes is used, so the daily total and its sessions are not counted twice. Planned or estimated time earns nothing.</p>
    <p>Output: {formatCapital(policy.taskCents)} per productive task ({formatCapital(policy.priorityTaskCents)} for high priority), {formatCapital(policy.milestoneCents)} per milestone, {formatCapital(policy.objectiveCents)} per objective, {formatCapital(policy.projectCents)} per project. An objective delivered by its recorded deadline adds {formatCapital(policy.deadlineBonusCents)}. Reopening removes its credit; completing it again restores the same original record.</p>
    <p>Focus premium: {formatCapital(policy.focusBonusCents)} per day with at least 90 focused minutes. Consistency dividend: {formatCapital(policy.streakBonusCents)} for each group of 7 consecutive productive days. A productive day means 60 recorded work minutes, 3 completed productive tasks, or 1 delivered objective. Today can remain unfinished without breaking yesterday’s streak.</p>
    <p>Index: 50% work against the expected trajectory, 30% weighted task completion, 20% productive-day consistency. If no tasks are scheduled, the weights are 60% work and 40% consistency. Scores are capped at 100; actual work and value can exceed targets.</p>
    <p>All amounts are fictional. Records are self-reported, editable, and recalculated after corrections. The profile shows personal performance; no external ranking or percentile is inferred.</p>
  </div></details></Card>;
}

function ProfileExport({ performance }: { performance: PerformanceData }) {
  const profile = createPerformanceProfile(performance);
  function download() {
    const url = URL.createObjectURL(new Blob([profile], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `performance-profile-${performance.today}.txt`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <div className="space-y-4"><p className="text-sm text-muted">Review your summary before sharing. This export contains metrics only; task titles and personal notes are excluded.</p><pre className="whitespace-pre-wrap rounded-2xl bg-panel2 p-4 text-sm leading-relaxed text-ink">{profile}</pre><PrimaryButton onClick={download}><Download className="h-4 w-4" />Export profile</PrimaryButton></div>;
}
