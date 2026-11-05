import { NextRequest } from "next/server";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/aiRequestTimeout";
import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path = [] } = await context.params;
  return proxyApiRequest(request, `/api/insights${path.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`, { timeoutMs: AI_REQUEST_TIMEOUT_MS });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
