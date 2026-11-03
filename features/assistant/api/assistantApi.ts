import { requestJson } from "@/lib/http/apiClient";
import { parseAssistantPreview, type AssistantInstruction, type AssistantPreview } from "../domain/assistant";

const ASSISTANT_TIMEOUT_MS = 190_000;

export function previewAssistant(instruction: AssistantInstruction, signal?: AbortSignal): Promise<AssistantPreview> {
  return requestJson("/api/assistant/preview", parseAssistantPreview, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(instruction), signal, timeoutMs: ASSISTANT_TIMEOUT_MS
  });
}
