import { Capacitor, registerPlugin } from "@capacitor/core";
import { requestJson, expectJsonObject, expectString } from "@/lib/http/apiClient";

export type PendingCapture = { id: string; title: string; createdAt: number; scope: string };
type CapturePlugin = {
  configure(options: { scope: string }): Promise<void>;
  list(options: { scope: string }): Promise<{ captures: PendingCapture[] }>;
  capture(options: { title: string }): Promise<void>;
  acknowledge(options: { id: string; scope: string }): Promise<void>;
  enableNotification(): Promise<{ enabled: boolean }>;
  disableNotification(): Promise<void>;
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

export async function captureTask(title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 500) throw new Error("Le titre doit contenir entre 1 et 500 caractères.");
  if (!currentScope) throw new Error("Connecte d’abord ton serveur.");
  if (Capacitor.isNativePlatform()) return native.capture({ title: trimmed });
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...readBrowserCaptures(), {
    id: crypto.randomUUID(), title: trimmed, createdAt: Date.now(), scope: currentScope
  }]));
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
    await requestJson("/api/tasks/capture", (payload) => {
      const receipt = expectJsonObject(payload);
      if (expectString(receipt.captureId, "captureId") !== capture.id) throw new Error("Capture acknowledgement mismatch");
    }, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: capture.id, title: capture.title }) });
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

function readBrowserCaptures(): PendingCapture[] {
  const entries: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  if (!Array.isArray(entries)) throw new Error("Le stockage des captures est illisible.");
  return entries.map((entry: unknown) => {
    const record = expectJsonObject(entry);
    if (typeof record.createdAt !== "number") throw new Error("Invalid capture date");
    return { id: expectString(record.id, "id"), title: expectString(record.title, "title"), scope: expectString(record.scope, "scope"), createdAt: record.createdAt };
  });
}
