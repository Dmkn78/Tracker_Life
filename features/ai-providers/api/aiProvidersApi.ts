import { expectJsonObject, expectNumber, expectStringArray, requestJson } from "@/lib/http/apiClient";
import { parseAiProvider, parseAiProviderCatalog, type AiProvider, type AiProviderCatalog, type AiProviderDraft, type ConnectionTestResult } from "../domain/aiProvider";

const PROVIDERS_URL = "/api/ai-providers";
const CONNECTION_TEST_TIMEOUT_MS = 30_000;
const JSON_HEADERS = { "Content-Type": "application/json" };

export type AiProviderPatch = { id: string; model?: string; label?: string; baseUrl?: string; apiKey?: string; isDefault?: boolean };

export function listAiProviders(signal?: AbortSignal): Promise<AiProviderCatalog> {
  return requestJson(PROVIDERS_URL, parseAiProviderCatalog, { signal });
}

export function createAiProvider(draft: AiProviderDraft): Promise<AiProvider> {
  const body = {
    kind: draft.kind,
    label: draft.label.trim() || undefined,
    baseUrl: draft.baseUrl.trim() || undefined,
    apiKey: draft.apiKey.trim() || undefined,
    model: draft.model
  };
  return requestJson(PROVIDERS_URL, parseProviderResponse, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
}

export function updateAiProvider(patch: AiProviderPatch): Promise<AiProvider> {
  return requestJson(PROVIDERS_URL, parseProviderResponse, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(patch) });
}

export function deleteAiProvider(id: string): Promise<void> {
  return requestJson(`${PROVIDERS_URL}?id=${encodeURIComponent(id)}`, () => undefined, { method: "DELETE" });
}

export function testDraftConnection(draft: AiProviderDraft, signal?: AbortSignal): Promise<ConnectionTestResult> {
  const body = { kind: draft.kind, baseUrl: draft.baseUrl.trim() || undefined, apiKey: draft.apiKey.trim() || undefined };
  return requestJson(`${PROVIDERS_URL}/test`, parseConnectionTest, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body), signal, timeoutMs: CONNECTION_TEST_TIMEOUT_MS
  });
}

export function testSavedConnection(providerId: string, signal?: AbortSignal): Promise<ConnectionTestResult> {
  return requestJson(`${PROVIDERS_URL}/test`, parseConnectionTest, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ providerId }), signal, timeoutMs: CONNECTION_TEST_TIMEOUT_MS
  });
}

function parseProviderResponse(payload: unknown): AiProvider {
  const response = expectJsonObject(payload, "AI provider response");
  return parseAiProvider(response.provider, "AI provider response.provider");
}

function parseConnectionTest(payload: unknown): ConnectionTestResult {
  const response = expectJsonObject(payload, "connection test");
  const testResult: ConnectionTestResult = {
    models: expectStringArray(response.models, "connection test.models"),
    latencyMs: expectNumber(response.latencyMs, "connection test.latencyMs")
  };
  return testResult;
}
