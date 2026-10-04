import { expectJsonObject, expectStringArray, requestJson } from "@/lib/http/apiClient";
import { parseAssistantPreview, type AssistantInstruction, type AssistantPreview, type AssistantProvider } from "../domain/assistant";

const ASSISTANT_TIMEOUT_MS = 190_000;

export function listAssistantModels(provider: AssistantProvider, signal?: AbortSignal): Promise<string[]> {
  return requestJson("/api/assistant/models", (payload) => {
    const response = expectJsonObject(payload, "assistant models");
    return expectStringArray(response.models, "assistant models.models");
  }, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }), signal, timeoutMs: 30_000 });
}

export function previewAssistant(provider: AssistantProvider, instruction: AssistantInstruction, signal?: AbortSignal): Promise<AssistantPreview> {
  return requestJson("/api/assistant/preview", parseAssistantPreview, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, ...instruction }), signal, timeoutMs: ASSISTANT_TIMEOUT_MS
  });
}
