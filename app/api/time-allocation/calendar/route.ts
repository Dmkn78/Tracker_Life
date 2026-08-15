import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const TIME_ALLOCATION_CALENDAR_API_PATH = "/api/time-allocation/calendar";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, TIME_ALLOCATION_CALENDAR_API_PATH);
}
