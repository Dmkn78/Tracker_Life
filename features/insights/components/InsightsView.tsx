"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton, SegmentedButton } from "@/components/ui";
import { useDefaultAiProvider } from "@/features/ai-providers/application/useDefaultAiProvider";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { toDateKey } from "@/lib/dates";
import { askHistory, fetchPatterns } from "../api/insightsApi";
import { PERIOD_PRESETS, findCustomPeriodProblem, periodFromPreset, type AnalysisPeriod, type HistoryPatterns, type InsightResult, type PeriodPreset } from "../domain/insights";
import { AnswerPanel } from "./AnswerPanel";
import { INSIGHTS_COPY, type InsightsCopy } from "./insightsCopy";
import { PatternsPanel } from "./PatternsPanel";

const DEFAULT_PERIOD_PRESET: PeriodPreset = 28;

type PeriodChoice = { kind: "preset"; days: PeriodPreset } | { kind: "custom"; period: AnalysisPeriod };

type AnswerState = { kind: "idle" } | { kind: "asking" } | { kind: "answered"; result: InsightResult } | { kind: "failed"; message: string };

export function InsightsView(): React.ReactElement {
  const { locale } = useLocale();
  const copy = INSIGHTS_COPY[locale];
  const [choice, setChoice] = useState<PeriodChoice>({ kind: "preset", days: DEFAULT_PERIOD_PRESET });
  const [customDraft, setCustomDraft] = useState<AnalysisPeriod>(() => periodFromPreset(DEFAULT_PERIOD_PRESET, toDateKey()));
  const [patterns, setPatterns] = useState<HistoryPatterns | null>(null);
  const period = choice.kind === "preset" ? periodFromPreset(choice.days, toDateKey()) : choice.period;
  const periodKey = `${period.from}:${period.to}`;
  const customProblem = findCustomPeriodProblem(customDraft);

  useEffect(() => {
    const controller = new AbortController();
    const [from, to] = periodKey.split(":");
    setPatterns(null);
    fetchPatterns({ from, to }, controller.signal).then(setPatterns).catch(() => undefined);
    return () => controller.abort();
  }, [periodKey]);

  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm font-semibold uppercase text-accent">{copy.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{copy.hint}</p>
      </header>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={copy.period}>
        <span className="text-sm text-muted">{copy.period} :</span>
        {PERIOD_PRESETS.map((candidate) => (
          <SegmentedButton key={candidate} type="button" active={choice.kind === "preset" && candidate === choice.days} onClick={() => setChoice({ kind: "preset", days: candidate })} className="ring-1 ring-line">{copy.days.replace("{count}", String(candidate))}</SegmentedButton>
        ))}
      </div>
      <form
        onSubmit={(event) => { event.preventDefault(); if (!customProblem) setChoice({ kind: "custom", period: customDraft }); }}
        className={`flex flex-wrap items-end gap-2 rounded-[18px] p-3 ring-1 ${choice.kind === "custom" ? "bg-accent/10 ring-accent/50" : "bg-panel2/40 ring-line"}`}
      >
        <span className="w-full text-xs font-semibold uppercase text-muted">{copy.customPeriod}</span>
        <label className="grid gap-1 text-xs text-muted">{copy.from}<input type="date" value={customDraft.from} max={customDraft.to || undefined} onChange={(event) => setCustomDraft((current) => ({ ...current, from: event.target.value }))} className="focus-ring min-h-10 rounded-xl bg-panel px-2 text-sm text-ink ring-1 ring-line" /></label>
        <label className="grid gap-1 text-xs text-muted">{copy.to}<input type="date" value={customDraft.to} min={customDraft.from || undefined} onChange={(event) => setCustomDraft((current) => ({ ...current, to: event.target.value }))} className="focus-ring min-h-10 rounded-xl bg-panel px-2 text-sm text-ink ring-1 ring-line" /></label>
        <SecondaryButton type="submit" disabled={customProblem !== null}>{copy.applyPeriod}</SecondaryButton>
        {customProblem ? <p className="w-full text-xs text-warn">{copy.periodProblems[customProblem]}</p> : null}
      </form>
      <p className="text-xs text-muted">{copy.analysedPeriod} : {period.from} → {period.to}</p>
      {patterns ? <PatternsPanel patterns={patterns} copy={copy} /> : null}
      <QuestionBox key={periodKey} copy={copy} period={period} />
    </div>
  );
}

function QuestionBox({ copy, period }: { copy: InsightsCopy; period: { from: string; to: string } }): React.ReactElement {
  const providerState = useDefaultAiProvider();
  const [question, setQuestion] = useState("");
  const [answerState, setAnswerState] = useState<AnswerState>({ kind: "idle" });
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function ask(questionText: string): Promise<void> {
    if (!questionText.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setQuestion(questionText);
    setAnswerState({ kind: "asking" });
    try {
      setAnswerState({ kind: "answered", result: await askHistory(questionText, period, controller.signal) });
    } catch (error: unknown) {
      if (!controller.signal.aborted) setAnswerState({ kind: "failed", message: error instanceof Error ? error.message : copy.failed });
    }
  }

  function cancel(): void {
    request.current?.abort();
    setAnswerState({ kind: "idle" });
  }

  const isReady = providerState.kind === "ready";
  return (
    <section className="grid gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><Sparkles className="h-5 w-5 text-violet" />{copy.ask}</h2>
      {!isReady && providerState.kind !== "loading" ? <p className="text-sm text-warn">{copy.needsAi}</p> : null}
      <div className="flex flex-wrap gap-2">
        {copy.quickQuestions.map((quickQuestion) => <SecondaryButton key={quickQuestion} type="button" disabled={!isReady || answerState.kind === "asking"} onClick={() => void ask(quickQuestion)} className="text-xs">{quickQuestion}</SecondaryButton>)}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void ask(question); }} className="flex flex-col gap-2 sm:flex-row">
        <input aria-label={copy.ask} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={copy.askPlaceholder} className="focus-ring min-h-11 min-w-0 flex-1 rounded-2xl bg-panel px-3 text-base text-ink ring-1 ring-line placeholder:text-muted/70" />
        {answerState.kind === "asking" ? (
          <SecondaryButton type="button" onClick={cancel}><LoaderCircle className="h-4 w-4 animate-spin" />{copy.cancel}</SecondaryButton>
        ) : (
          <PrimaryButton type="submit" disabled={!isReady || !question.trim()}>{copy.askButton}</PrimaryButton>
        )}
      </form>
      {answerState.kind === "asking" ? <p role="status" className="text-sm text-muted">{copy.asking}</p> : null}
      {answerState.kind === "failed" ? <p role="alert" className="text-sm text-risk">{answerState.message}</p> : null}
      {answerState.kind === "answered" ? <AnswerPanel result={answerState.result} copy={copy} /> : null}
    </section>
  );
}
