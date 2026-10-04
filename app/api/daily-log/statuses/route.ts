import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, "/api/daily-log/statuses");
}
