import { Capacitor, registerPlugin } from "@capacitor/core";
import { ApiError, requestJson, expectJsonObject, expectString } from "@/lib/http/apiClient";
import { isCaptureTextValid, type CaptureKind, type CaptureOutcome, type CaptureRequest } from "@/features/quick-capture/domain/quickCapture";

/** Captures saved by the widget or offline wait here; the server deduplicates them by id. */
export type PendingCapture = { id: string; kind: CaptureKind; title: string; date: string | null; createdAt: number; scope: string };
type CaptureFields = Pick<PendingCapture, "id" | "kind" | "title" | "date">;
type CapturePlugin = {
  configure(options: { scope: string }): Promise<void>;
  list(options: { scope: string }): Promise<{ captures: PendingCapture[] }>;
  capture(options: CaptureFields): Promise<void>;
  acknowledge(options: { id: string; scope: string }): Promise<void>;
  enableNotification(): Promise<{ enabled: boolean }>;
  disableNotification(): Promise<void>;
  updateSummary(options: { scope: string; date: string; completed: number; total: number; titles?: string[] }): Promise<void>;
  showTaskKeyboard(): Promise<void>;
  notificationState(): Promise<{ enabled: boolean; permissionGranted: boolean }>;
  summaryError(options: { scope: string; message: string }): Promise<void>;
  openNotificationSettings(): Promise<void>;
};
const native = registerPlugin<CapturePlugin>("QuickCapture");
const STORAGE_KEY = "life-regime:pending-captures";
let currentScope = "";
let activeSync: Promise<number> | null = null;

export async function configureCaptures(scope: string): Promise<void> {
  currentScope = scope;
  if (Capacitor.isNativePlatform()) await native.configure({ scope });
}

export async function listCaptures(): Promise<PendingCapture[]> {
  if (Capacitor.isNativePlatform()) return (await native.list({ scope: currentScope })).captures;
  return readBrowserCaptures().filter((capture) => capture.scope === currentScope);
}

/**
 * Phone capture: send now through the idempotent endpoints; if the network fails,
 * keep the capture (same id) on the phone so a later retry cannot create a duplicate.
 */
export async function submitOrQueueCapture(capture: CaptureRequest): Promise<CaptureOutcome> {
  if (!isCaptureTextValid(capture.kind, capture.text)) throw new Error("Le texte est vide ou trop long.");
  const fields: CaptureFields = { id: crypto.randomUUID(), kind: capture.kind, title: capture.text, date: capture.date };
  try {
    await sendCapture(fields);
    return "saved";
  } catch (error: unknown) {
    if (isDefiniteRejection(error)) throw error;
    await queueCapture(fields);
    return "queued";
  }
}

async function queueCapture(fields: CaptureFields): Promise<void> {
  if (!currentScope) throw new Error("Connecte d’abord ton serveur.");
  if (Capacitor.isNativePlatform()) return native.capture(fields);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...readBrowserCaptures(), { ...fields, createdAt: Date.now(), scope: currentScope }]));
}

/** 4xx answers (except timeout/throttling) mean the server refused it: retrying would not help. */
function isDefiniteRejection(error: unknown): boolean {
  const isRejected = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
  return isRejected;
}

async function sendCapture(capture: CaptureFields): Promise<void> {
  const acknowledge = (payload: unknown) => {
    if (expectString(expectJsonObject(payload).captureId, "captureId") !== capture.id) throw new Error("Capture acknowledgement mismatch");
  };
  const request = capture.kind === "note"
    ? { url: "/api/knowledge/notes", body: { requestId: capture.id, text: capture.title } }
    : { url: "/api/tasks/capture", body: { requestId: capture.id, title: capture.title, date: capture.date } };
  await requestJson(request.url, acknowledge, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.body) });
}

export function syncCaptures(): Promise<number> {
  if (activeSync) return activeSync;
  activeSync = sendPendingCaptures().finally(() => { activeSync = null; });
  return activeSync;
}

export async function waitForCaptureSync(): Promise<void> {
  await activeSync?.catch(() => undefined);
}

async function sendPendingCaptures(): Promise<number> {
  const scope = currentScope;
  const captures = await listCaptures();
  let sent = 0;
  for (const capture of captures) {
    if (currentScope !== scope) break;
    await sendCapture(capture);
    if (Capacitor.isNativePlatform()) await native.acknowledge({ id: capture.id, scope });
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(readBrowserCaptures().filter((entry) => entry.id !== capture.id)));
    sent++;
  }
  return sent;
}

export async function enableQuickNotification(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) throw new Error("Disponible dans l’APK Android.");
  return (await native.enableNotification()).enabled;
}

export async function disableQuickNotification(): Promise<void> {
  if (Capacitor.isNativePlatform()) await native.disableNotification();
}

export async function updateNotificationSummary(scope: string, summary: { date: string; completed: number; total: number; titles?: string[] }): Promise<void> {
  if (Capacitor.isNativePlatform()) await native.updateSummary({ scope, ...summary });
}

export async function showTaskKeyboard(): Promise<void> {
  if (Capacitor.isNativePlatform()) await native.showTaskKeyboard();
}

function readBrowserCaptures(): PendingCapture[] {
  const entries: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  if (!Array.isArray(entries)) throw new Error("Le stockage des captures est illisible.");
  return entries.map((entry: unknown) => {
    const record = expectJsonObject(entry);
    if (typeof record.createdAt !== "number") throw new Error("Invalid capture date");
    return {
      id: expectString(record.id, "id"), title: expectString(record.title, "title"), scope: expectString(record.scope, "scope"), createdAt: record.createdAt,
      // Captures stored before notes existed are undated tasks.
      kind: record.kind === "note" ? "note" : "task",
      date: typeof record.date === "string" ? record.date : null
    };
  });
}

export async function getNotificationState(): Promise<{ enabled: boolean; permissionGranted: boolean }> {
  return Capacitor.isNativePlatform() ? native.notificationState() : { enabled: false, permissionGranted: false };
}
export async function markNotificationSyncError(scope: string, message: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await native.summaryError({ scope, message });
}
export async function openNotificationSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) await native.openNotificationSettings();
}
