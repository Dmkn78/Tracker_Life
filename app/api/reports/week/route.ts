import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const WEEKLY_REPORT_API_PATH = "/api/reports/week";

export async function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, WEEKLY_REPORT_API_PATH);
}
