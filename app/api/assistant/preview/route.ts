import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, "/api/assistant/preview", { timeoutMs: 190_000 });
}
