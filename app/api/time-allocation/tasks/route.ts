import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const TIME_ALLOCATION_TASKS_API_PATH = "/api/time-allocation/tasks";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, TIME_ALLOCATION_TASKS_API_PATH);
}
