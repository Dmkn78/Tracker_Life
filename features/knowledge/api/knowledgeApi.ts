import { expectBoolean, expectJsonObject, expectNullableString, expectNumber, expectString, expectStringArray, parseJsonArray, requestJson } from "@/lib/http/apiClient";
import type { NoteDocument, NoteLink, SearchResult, SyncReport, VaultStatus } from "../domain/knowledge";

const JSON_HEADERS = { "Content-Type": "application/json" };
const SYNC_TIMEOUT_MS = 60_000;

export function fetchVaultStatus(signal?: AbortSignal): Promise<VaultStatus> {
  return requestJson("/api/knowledge/status", (payload) => {
    const status = expectJsonObject(payload, "vault status");
    return {
      vaultPath: expectString(status.vaultPath, "vault status.vaultPath"),
      exists: expectBoolean(status.exists, "vault status.exists"),
      noteCount: expectNumber(status.noteCount, "vault status.noteCount"),
      managedCount: expectNumber(status.managedCount, "vault status.managedCount")
    };
  }, { signal });
}

export function syncVault(): Promise<SyncReport> {
  return requestJson("/api/knowledge/sync", (payload) => {
    const report = expectJsonObject(expectJsonObject(payload, "sync").report, "sync.report");
    return {
      created: expectNumber(report.created, "sync.report.created"),
      updated: expectNumber(report.updated, "sync.report.updated"),
      unchanged: expectNumber(report.unchanged, "sync.report.unchanged"),
      conflicts: expectStringArray(report.conflicts, "sync.report.conflicts")
    };
  }, { method: "POST", timeoutMs: SYNC_TIMEOUT_MS });
}

export function searchNotes(query: string, noteTypes: string[], signal?: AbortSignal): Promise<SearchResult[]> {
  const parameters = new URLSearchParams({ q: query });
  noteTypes.forEach((noteType) => parameters.append("type", noteType));
  return requestJson(`/api/knowledge/search?${parameters.toString()}`, (payload) => (
    parseJsonArray(expectJsonObject(payload, "search").results, "search.results", parseSearchResult)
  ), { signal });
}

export function captureNote(text: string): Promise<{ path: string; title: string }> {
  return requestJson("/api/knowledge/notes", (payload) => {
    const created = expectJsonObject(payload, "captured note");
    return { path: expectString(created.path, "captured note.path"), title: expectString(created.title, "captured note.title") };
  }, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ text }) });
}

export function readNote(path: string, signal?: AbortSignal): Promise<NoteDocument> {
  return requestJson(`/api/knowledge/note?path=${encodeURIComponent(path)}`, (payload) => {
    const note = expectJsonObject(payload, "note");
    return {
      path: expectString(note.path, "note.path"),
      frontmatter: expectJsonObject(note.frontmatter, "note.frontmatter"),
      body: expectString(note.body, "note.body"),
      links: parseJsonArray(note.links, "note.links", parseNoteLink)
    };
  }, { signal });
}

function parseSearchResult(payload: unknown, context: string): SearchResult {
  const hit = expectJsonObject(payload, context);
  const result: SearchResult = {
    path: expectString(hit.path, `${context}.path`),
    title: expectString(hit.title, `${context}.title`),
    noteType: expectString(hit.noteType, `${context}.noteType`),
    dateKey: expectNullableString(hit.dateKey, `${context}.dateKey`),
    excerpt: expectString(hit.excerpt, `${context}.excerpt`),
    heading: expectString(hit.heading, `${context}.heading`),
    reasons: expectStringArray(hit.reasons, `${context}.reasons`)
  };
  return result;
}

function parseNoteLink(payload: unknown, context: string): NoteLink {
  const link = expectJsonObject(payload, context);
  return { path: expectString(link.path, `${context}.path`), title: expectString(link.title, `${context}.title`) };
}
