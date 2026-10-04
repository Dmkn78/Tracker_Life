import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const TASK_TEMPLATES_API_PATH = "/api/task-templates";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, TASK_TEMPLATES_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, TASK_TEMPLATES_API_PATH);
}

export function DELETE(request: Request): Promise<Response> {
  return proxyApiRequest(request, TASK_TEMPLATES_API_PATH);
}
