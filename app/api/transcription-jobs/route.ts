import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

export async function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, "/api/transcription-jobs", { timeoutMs: 610_000 });
}
