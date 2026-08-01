import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const TIME_ALLOCATION_API_PATH = "/api/time-allocation";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, TIME_ALLOCATION_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, TIME_ALLOCATION_API_PATH);
}

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, TIME_ALLOCATION_API_PATH);
}

export function DELETE(request: Request): Promise<Response> {
  return proxyApiRequest(request, TIME_ALLOCATION_API_PATH);
}
