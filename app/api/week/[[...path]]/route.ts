import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path = [] } = await context.params;
  return proxyApiRequest(request, `/api/week${path.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`);
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
