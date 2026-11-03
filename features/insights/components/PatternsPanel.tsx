"use client";

import { Panel } from "@/components/ui";
import { hasAnyActivity, type HistoryPatterns, type RecurringItem } from "../domain/insights";
import type { InsightsCopy } from "./insightsCopy";

export function PatternsPanel({ patterns, copy }: { patterns: HistoryPatterns; copy: InsightsCopy }): React.ReactElement {
  if (!hasAnyActivity(patterns)) return <Panel><p className="text-sm text-muted">{copy.noActivity}</p></Panel>;
  const ratePercent = Math.round(patterns.completionRate * 100);
  return (
    <Panel>
      <h2 className="text-lg font-semibold text-ink">{copy.computed}</h2>
      <p className="mt-2 text-sm text-ink">{copy.completion.replace("{done}", String(patterns.done)).replace("{planned}", String(patterns.planned)).replace("{rate}", String(ratePercent))}</p>
      <p className="text-sm text-muted">{copy.recapDays.replace("{count}", String(patterns.daysWithRecap)).replace("{total}", String(patterns.dayCount))}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {patterns.weekdayRates.length ? (
          <FindingBlock title={copy.byWeekday}>
            {patterns.weekdayRates.map((rate) => <li key={rate.weekday} className="flex justify-between gap-2 capitalize"><span>{rate.weekday}</span><span className="text-muted">{rate.done}/{rate.planned}</span></li>)}
          </FindingBlock>
        ) : null}
        <RecurringBlock title={copy.postponed} items={patterns.postponedTasks} copy={copy} />
        <RecurringBlock title={copy.blockers} items={patterns.recurringBlockers} copy={copy} />
        <RecurringBlock title={copy.recurring} items={patterns.recurringTasks} copy={copy} />
        <RecurringBlock title={copy.keywords} items={patterns.blockerKeywords} copy={copy} />
        {patterns.objectiveActivity.length ? (
          <FindingBlock title={copy.goals}>
            {patterns.objectiveActivity.map((activity) => <li key={activity.title} className="flex justify-between gap-2"><span className="min-w-0 break-words">{activity.title}</span><span className="shrink-0 text-muted">{activity.done}/{activity.planned}</span></li>)}
          </FindingBlock>
        ) : null}
        {patterns.idleObjectives.length ? (
          <FindingBlock title={copy.idleGoals}>{patterns.idleObjectives.map((title) => <li key={title}>{title}</li>)}</FindingBlock>
        ) : null}
      </div>
    </Panel>
  );
}

function RecurringBlock({ title, items, copy }: { title: string; items: RecurringItem[]; copy: InsightsCopy }): React.ReactElement | null {
  if (!items.length) return null;
  return (
    <FindingBlock title={title}>
      {items.map((item) => (
        <li key={item.label}>
          <details>
            <summary className="cursor-pointer">
              <span className="break-words">{item.label}</span>{" "}
              <span className="text-muted">{copy.times.replace("{count}", String(item.count))}{item.doneCount ? ` · ${copy.doneOf.replace("{done}", String(item.doneCount))}` : ""}</span>
            </summary>
            <ul className="mt-1 grid gap-0.5 border-l border-line pl-3 text-xs text-muted">
              {item.evidence.map((record, index) => <li key={`${record.date}-${index}`}>{record.date ?? "—"} · {record.text}</li>)}
            </ul>
          </details>
        </li>
      ))}
    </FindingBlock>
  );
}

function FindingBlock({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="rounded-2xl bg-panel2/50 p-3 ring-1 ring-line">
      <h3 className="text-xs font-semibold uppercase text-muted">{title}</h3>
      <ul className="mt-2 grid gap-1 text-sm text-ink">{children}</ul>
    </section>
  );
}
