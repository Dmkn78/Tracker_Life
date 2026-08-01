import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const TASKS_API_PATH = "/api/tasks";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, TASKS_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, TASKS_API_PATH);
}

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, TASKS_API_PATH);
}
