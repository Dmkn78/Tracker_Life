import { AI_REQUEST_TIMEOUT_MS } from "@/lib/aiRequestTimeout";
import { requestJson } from "@/lib/http/apiClient";
import { parseAssistantPreview, type AssistantInstruction, type AssistantPreview } from "../domain/assistant";



export function previewAssistant(instruction: AssistantInstruction, signal?: AbortSignal): Promise<AssistantPreview> {
  return requestJson("/api/assistant/preview", parseAssistantPreview, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(instruction), signal, timeoutMs: AI_REQUEST_TIMEOUT_MS
  });
}
