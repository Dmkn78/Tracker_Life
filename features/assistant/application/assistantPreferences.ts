import { Capacitor } from "@capacitor/core";
import type { AssistantProvider } from "../domain/assistant";

export const DEFAULT_ASSISTANT_PROVIDER: AssistantProvider = { baseUrl: "http://127.0.0.1:1234/v1", model: "" };
export const ASSISTANT_PREFERENCES_EVENT = "life-regime:assistant-preferences";
const sessionProviders = new Map<string, AssistantProvider>();

export function readAssistantProvider(): AssistantProvider {
  const scope = getAssistantScope();
  const sessionProvider = sessionProviders.get(scope);
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(scope) ?? "null");
    if (stored && typeof stored === "object" && "baseUrl" in stored && "model" in stored && typeof stored.baseUrl === "string" && typeof stored.model === "string") {
      return { baseUrl: stored.baseUrl, model: stored.model, apiKey: stored.baseUrl === sessionProvider?.baseUrl ? sessionProvider.apiKey : undefined };
    }
  } catch { /* Storage may be unavailable; keep session defaults usable. */ }
  return sessionProvider ? { ...sessionProvider } : { ...DEFAULT_ASSISTANT_PROVIDER };
}

export function writeAssistantProvider(provider: AssistantProvider): boolean {
  const scope = getAssistantScope();
  sessionProviders.set(scope, { ...provider });
  let persisted = true;
  try { window.localStorage.setItem(scope, JSON.stringify({ baseUrl: provider.baseUrl, model: provider.model })); }
  catch { persisted = false; }
  window.dispatchEvent(new Event(ASSISTANT_PREFERENCES_EVENT));
  return persisted;
}

function getAssistantScope(): string {
  if (typeof window === "undefined") return "life-regime:assistant:ssr";
  let apiOrigin = window.location.origin;
  if (Capacitor.isNativePlatform()) {
    try { apiOrigin = window.localStorage.getItem("life-regime:server") || apiOrigin; } catch { /* Use browser origin. */ }
  }
  return `life-regime:assistant:${apiOrigin}`;
}
