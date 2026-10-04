import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

export async function GET(request: Request, { params }: { params: Promise<{ digest: string }> }): Promise<Response> {
  const { digest } = await params;
  if (!/^[a-f0-9]{64}$/.test(digest)) return new Response(null, { status: 404 });
  return proxyApiRequest(request, `/api/mobile-update/apk/${digest}`, { timeoutMs: 120_000 });
}
