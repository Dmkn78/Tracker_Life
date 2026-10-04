import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

export async function GET(request: Request): Promise<Response> {
  const response = await proxyApiRequest(request, "/api/mobile-update", { timeoutMs: 45_000 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
