import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const HABITS_API_PATH = "/api/habits";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, HABITS_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, HABITS_API_PATH);
}

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, HABITS_API_PATH);
}

export function DELETE(request: Request): Promise<Response> {
  return proxyApiRequest(request, HABITS_API_PATH);
}
