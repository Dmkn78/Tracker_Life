import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const TRANSCRIBE_API_PATH = "/api/transcribe";
const TRANSCRIBE_PROXY_TIMEOUT_MS = 185_000;

export async function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, TRANSCRIBE_API_PATH, {
    timeoutMs: TRANSCRIBE_PROXY_TIMEOUT_MS
  });
}
