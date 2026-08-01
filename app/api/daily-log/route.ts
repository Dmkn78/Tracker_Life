import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const DAILY_LOG_API_PATH = "/api/daily-log";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, DAILY_LOG_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, DAILY_LOG_API_PATH);
}
