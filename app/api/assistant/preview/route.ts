import { AI_REQUEST_TIMEOUT_MS } from "@/lib/aiRequestTimeout";
import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, "/api/assistant/preview", { timeoutMs: AI_REQUEST_TIMEOUT_MS });
}
