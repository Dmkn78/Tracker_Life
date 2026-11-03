import { expectBoolean, expectJsonObject, expectNullableString, expectNumber, expectString, expectStringArray, parseJsonArray, requestJson } from "@/lib/http/apiClient";
import type { AnalysisPeriod, CitedStatement, EvidenceRecord, HistoryPatterns, InsightResult, InsightSource, RecurringItem } from "../domain/insights";

const ANALYSIS_TIMEOUT_MS = 190_000;

export function fetchPatterns(period: AnalysisPeriod, signal?: AbortSignal): Promise<HistoryPatterns> {
  const query = new URLSearchParams({ from: period.from, to: period.to });
  return requestJson(`/api/insights/patterns?${query.toString()}`, (payload) => parsePatterns(expectJsonObject(payload, "patterns response").patterns), { signal });
}

export function askHistory(question: string, period: AnalysisPeriod, signal?: AbortSignal): Promise<InsightResult> {
  return requestJson("/api/insights/ask", parseInsightResult, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, from: period.from, to: period.to }),
    signal,
    timeoutMs: ANALYSIS_TIMEOUT_MS
  });
}

function parsePatterns(payload: unknown): HistoryPatterns {
  const patterns = expectJsonObject(payload, "patterns");
  const parsedPatterns: HistoryPatterns = {
    planned: expectNumber(patterns.planned, "patterns.planned"),
    done: expectNumber(patterns.done, "patterns.done"),
    dropped: expectNumber(patterns.dropped, "patterns.dropped"),
    open: expectNumber(patterns.open, "patterns.open"),
    completionRate: expectNumber(patterns.completionRate, "patterns.completionRate"),
    daysWithRecap: expectNumber(patterns.daysWithRecap, "patterns.daysWithRecap"),
    dayCount: expectNumber(patterns.dayCount, "patterns.dayCount"),
    weekdayRates: parseJsonArray(patterns.weekdayRates, "patterns.weekdayRates", (entry, context) => {
      const rate = expectJsonObject(entry, context);
      return { weekday: expectString(rate.weekday, `${context}.weekday`), planned: expectNumber(rate.planned, `${context}.planned`), done: expectNumber(rate.done, `${context}.done`) };
    }),
    recurringTasks: parseJsonArray(patterns.recurringTasks, "patterns.recurringTasks", parseRecurringItem),
    postponedTasks: parseJsonArray(patterns.postponedTasks, "patterns.postponedTasks", parseRecurringItem),
    recurringBlockers: parseJsonArray(patterns.recurringBlockers, "patterns.recurringBlockers", parseRecurringItem),
    blockerKeywords: parseJsonArray(patterns.blockerKeywords, "patterns.blockerKeywords", parseRecurringItem),
    objectiveActivity: parseJsonArray(patterns.objectiveActivity, "patterns.objectiveActivity", (entry, context) => {
      const activity = expectJsonObject(entry, context);
      return { title: expectString(activity.title, `${context}.title`), planned: expectNumber(activity.planned, `${context}.planned`), done: expectNumber(activity.done, `${context}.done`) };
    }),
    idleObjectives: expectStringArray(patterns.idleObjectives, "patterns.idleObjectives")
  };
  return parsedPatterns;
}

function parseRecurringItem(payload: unknown, context: string): RecurringItem {
  const item = expectJsonObject(payload, context);
  const recurringItem: RecurringItem = {
    label: expectString(item.label, `${context}.label`),
    count: expectNumber(item.count, `${context}.count`),
    doneCount: expectNumber(item.doneCount, `${context}.doneCount`),
    evidence: parseJsonArray(item.evidence, `${context}.evidence`, parseEvidenceRecord)
  };
  return recurringItem;
}

function parseEvidenceRecord(payload: unknown, context: string): EvidenceRecord {
  const record = expectJsonObject(payload, context);
  return { date: expectNullableString(record.date, `${context}.date`), text: expectString(record.text, `${context}.text`) };
}

function parseInsightResult(payload: unknown): InsightResult {
  const response = expectJsonObject(payload, "insight");
  const answer = expectJsonObject(response.answer, "insight.answer");
  const period = expectJsonObject(response.period, "insight.period");
  const result: InsightResult = {
    period: { from: expectString(period.from, "insight.period.from"), to: expectString(period.to, "insight.period.to") },
    answer: {
      summary: expectString(answer.summary, "insight.answer.summary"),
      facts: parseJsonArray(answer.facts, "insight.answer.facts", parseStatement),
      hypotheses: parseJsonArray(answer.hypotheses, "insight.answer.hypotheses", parseStatement),
      recommendations: parseJsonArray(answer.recommendations, "insight.answer.recommendations", parseStatement),
      unverified: parseJsonArray(answer.unverified, "insight.answer.unverified", parseStatement)
    },
    sources: parseJsonArray(response.sources, "insight.sources", parseSource),
    evidenceCount: expectNumber(response.evidenceCount, "insight.evidenceCount"),
    isTruncated: expectBoolean(response.isTruncated, "insight.isTruncated")
  };
  return result;
}

function parseStatement(payload: unknown, context: string): CitedStatement {
  const statement = expectJsonObject(payload, context);
  return { text: expectString(statement.text, `${context}.text`), sources: expectStringArray(statement.sources, `${context}.sources`) };
}

function parseSource(payload: unknown, context: string): InsightSource {
  const source = expectJsonObject(payload, context);
  const parsedSource: InsightSource = {
    id: expectString(source.id, `${context}.id`),
    kind: expectString(source.kind, `${context}.kind`),
    date: expectNullableString(source.date, `${context}.date`),
    title: expectString(source.title, `${context}.title`),
    text: expectString(source.text, `${context}.text`),
    path: expectNullableString(source.path, `${context}.path`)
  };
  return parsedSource;
}
