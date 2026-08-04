import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const TASKS_REORDER_API_PATH = "/api/tasks/reorder";

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, TASKS_REORDER_API_PATH);
}
