"use client";

import { RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Pill, PrimaryButton, SecondaryButton, SegmentedButton } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { CAPTURE_SAVED_EVENT } from "@/features/quick-capture/domain/quickCapture";
import { captureNote, fetchVaultStatus, searchNotes, syncVault } from "../api/knowledgeApi";
import { NOTE_TYPE_FILTERS, toSearchTypes, type NoteTypeFilter, type SearchResult, type SyncReport, type VaultStatus } from "../domain/knowledge";
import { KNOWLEDGE_COPY, type KnowledgeCopy } from "./knowledgeCopy";
import { NoteReader } from "./NoteReader";

const SEARCH_DEBOUNCE_MS = 250;

export function KnowledgeView(): React.ReactElement {
  const { locale } = useLocale();
  const copy = KNOWLEDGE_COPY[locale];
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NoteTypeFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const requestedNotePath = useSearchParams().get("note");
  const [openPath, setOpenPath] = useState<string | null>(requestedNotePath);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchNotes(query, toSearchTypes(typeFilter), controller.signal).then(setResults).catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, typeFilter, refreshKey]);

  const refreshResults = useCallback(() => setRefreshKey((current) => current + 1), []);

  useEffect(() => {
    window.addEventListener(CAPTURE_SAVED_EVENT, refreshResults);
    return () => window.removeEventListener(CAPTURE_SAVED_EVENT, refreshResults);
  }, [refreshResults]);

  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm font-semibold uppercase text-accent">{copy.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{copy.hint}</p>
      </header>
      <VaultBar copy={copy} onSynced={refreshResults} />
      <QuickNote copy={copy} onCreated={(path) => { refreshResults(); setOpenPath(path); }} />
      <section className="grid gap-3">
        <label className="flex items-center gap-2 rounded-[22px] bg-panel px-3 ring-1 ring-line">
          <Search className="h-4 w-4 text-muted" />
          <input aria-label={copy.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} className="focus-ring min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted/70" />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={copy.filterByType}>
          {NOTE_TYPE_FILTERS.map((filter) => <SegmentedButton key={filter} type="button" active={typeFilter === filter} onClick={() => setTypeFilter(filter)} className="ring-1 ring-line">{copy.filters[filter]}</SegmentedButton>)}
        </div>
        {openPath ? <NoteReader path={openPath} copy={copy} onOpen={setOpenPath} onClose={() => setOpenPath(null)} /> : null}
        <h2 className="text-sm font-semibold text-muted">{query.trim() ? copy.results : copy.recent}</h2>
        {!results.length ? <p className="text-sm text-muted">{copy.noResults}</p> : null}
        <ul className="grid gap-2">
          {results.map((result) => <SearchResultItem key={result.path} result={result} copy={copy} onOpen={() => setOpenPath(result.path)} />)}
        </ul>
      </section>
    </div>
  );
}

function SearchResultItem({ result, copy, onOpen }: { result: SearchResult; copy: KnowledgeCopy; onOpen: () => void }): React.ReactElement {
  return (
    <li>
      <button type="button" onClick={onOpen} className="focus-ring grid w-full gap-1 rounded-[18px] bg-panel/80 p-3 text-left ring-1 ring-line transition hover:ring-accent/50">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold text-ink">{result.title}</span>
          <span className="text-xs text-muted">{result.noteType}{result.dateKey ? ` · ${result.dateKey}` : ""}</span>
        </div>
        {result.excerpt ? <p className="line-clamp-3 text-sm text-muted">{result.excerpt}</p> : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="break-all font-mono text-[11px] text-muted/80">{result.path}</span>
          {result.reasons.map((reason) => <Pill key={reason} className="text-[11px]">{copy.why} : {reason}</Pill>)}
        </div>
      </button>
    </li>
  );
}

function QuickNote({ copy, onCreated }: { copy: KnowledgeCopy; onCreated: (path: string) => void }): React.ReactElement {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function save(): Promise<void> {
    setIsSaving(true);
    try {
      const created = await captureNote(text);
      setText("");
      setMessage(copy.saved.replace("{path}", created.path));
      onCreated(created.path);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : copy.failed);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="grid gap-2 rounded-[22px] bg-panel p-3 ring-1 ring-line">
      <textarea aria-label={copy.capture} rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.capturePlaceholder} className="focus-ring w-full resize-y rounded-xl bg-transparent px-2 py-1.5 text-base text-ink placeholder:text-muted/70" />
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" disabled={!text.trim() || isSaving} onClick={() => void save()}>{copy.save}</PrimaryButton>
        {message ? <p role="status" className="break-all text-sm text-muted">{message}</p> : null}
      </div>
    </section>
  );
}

function VaultBar({ copy, onSynced }: { copy: KnowledgeCopy; onSynced: () => void }): React.ReactElement {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");

  const synchronize = useCallback(async (): Promise<void> => {
    setIsSyncing(true);
    setError("");
    try {
      setReport(await syncVault());
      setStatus(await fetchVaultStatus());
      onSynced();
    } catch (syncError: unknown) {
      setError(syncError instanceof Error ? syncError.message : copy.failed);
    } finally {
      setIsSyncing(false);
    }
  }, [copy.failed, onSynced]);

  // Tracked data is projected on arrival so the vault is current without any manual step.
  useEffect(() => { void synchronize(); }, [synchronize]);

  return (
    <div className="grid gap-1.5 rounded-[18px] bg-panel2/50 px-3 py-2 text-sm ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-muted">
          {copy.vault} : <span className="break-all font-mono text-xs">{status?.vaultPath ?? "…"}</span>
          {status ? ` · ${status.noteCount} ${copy.notes}` : ""}
        </p>
        <SecondaryButton type="button" disabled={isSyncing} onClick={() => void synchronize()}>
          <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />{isSyncing ? copy.syncing : copy.sync}
        </SecondaryButton>
      </div>
      {report ? <p className="text-xs text-muted">{copy.syncReport.replace("{created}", String(report.created)).replace("{updated}", String(report.updated)).replace("{unchanged}", String(report.unchanged))}</p> : null}
      {report?.conflicts.length ? <p className="text-xs text-warn">{copy.conflicts} {report.conflicts.join(", ")}</p> : null}
      {error ? <p role="alert" className="text-xs text-risk">{error}</p> : null}
    </div>
  );
}
