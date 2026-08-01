import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const OBJECTIVES_API_PATH = "/api/objectives";

export async function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, OBJECTIVES_API_PATH);
}

export async function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, OBJECTIVES_API_PATH);
}

export async function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, OBJECTIVES_API_PATH);
}

export async function DELETE(request: Request): Promise<Response> {
  return proxyApiRequest(request, OBJECTIVES_API_PATH);
}
