"use client";

import Link from "next/link";
import { Panel } from "@/components/ui";
import type { CitedStatement, InsightResult, InsightSource } from "../domain/insights";
import type { InsightsCopy } from "./insightsCopy";

type StatementTone = "fact" | "hypothesis" | "recommendation" | "unverified";

const TONE_STYLES: Record<StatementTone, string> = {
  fact: "border-good/60",
  hypothesis: "border-warn/60",
  recommendation: "border-accent/60",
  unverified: "border-line text-muted line-through"
};

/** Facts, hypotheses and recommendations are visually separated, each with its sources. */
export function AnswerPanel({ result, copy }: { result: InsightResult; copy: InsightsCopy }): React.ReactElement {
  const sourcesById = new Map(result.sources.map((source) => [source.id, source]));
  return (
    <Panel>
      <h2 className="text-lg font-semibold text-ink">{copy.summary}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{result.answer.summary}</p>
      <p className="mt-1 text-xs text-muted">{result.period.from} → {result.period.to} · {copy.evidence.replace("{count}", String(result.evidenceCount))}</p>
      {result.isTruncated ? <p className="mt-1 text-xs text-warn">{copy.truncated}</p> : null}
      <StatementSection title={copy.facts} statements={result.answer.facts} tone="fact" sourcesById={sourcesById} />
      <StatementSection title={copy.hypotheses} statements={result.answer.hypotheses} tone="hypothesis" sourcesById={sourcesById} />
      <StatementSection title={copy.recommendations} statements={result.answer.recommendations} tone="recommendation" sourcesById={sourcesById} />
      <StatementSection title={copy.unverified} statements={result.answer.unverified} tone="unverified" sourcesById={sourcesById} />
      {result.sources.length ? (
        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase text-muted">{copy.sources}</h3>
          <ul className="mt-2 grid gap-2">
            {result.sources.map((source) => <SourceItem key={source.id} source={source} copy={copy} />)}
          </ul>
        </section>
      ) : null}
    </Panel>
  );
}

function StatementSection({ title, statements, tone, sourcesById }: {
  title: string;
  statements: CitedStatement[];
  tone: StatementTone;
  sourcesById: Map<string, InsightSource>;
}): React.ReactElement | null {
  if (!statements.length) return null;
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold uppercase text-muted">{title}</h3>
      <ul className="mt-2 grid gap-2">
        {statements.map((statement, index) => (
          <li key={`${tone}-${index}`} className={`border-l-2 pl-3 text-sm text-ink ${TONE_STYLES[tone]}`}>
            {statement.text}{" "}
            {statement.sources.map((sourceId) => (
              <a key={sourceId} href={`#source-${sourceId}`} title={sourcesById.get(sourceId)?.title} className="ml-1 rounded bg-panel2 px-1.5 py-0.5 font-mono text-[11px] text-accent ring-1 ring-line">{sourceId}</a>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceItem({ source, copy }: { source: InsightSource; copy: InsightsCopy }): React.ReactElement {
  return (
    <li id={`source-${source.id}`} className="rounded-xl bg-panel2/50 p-2.5 ring-1 ring-line target:ring-accent">
      <details>
        <summary className="cursor-pointer text-sm">
          <span className="font-mono text-xs text-accent">{source.id}</span> <span className="text-ink">{source.title}</span>
          {source.date ? <span className="text-xs text-muted"> · {source.date}</span> : null}
        </summary>
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-muted">{source.text}</pre>
        {source.path ? <Link href={`/knowledge?note=${encodeURIComponent(source.path)}`} className="mt-1 inline-block text-xs text-accent">{copy.openNote} →</Link> : null}
      </details>
    </li>
  );
}
