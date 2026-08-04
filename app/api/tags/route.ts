import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const TAGS_API_PATH = "/api/tags";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, TAGS_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, TAGS_API_PATH);
}

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, TAGS_API_PATH);
}

export function DELETE(request: Request): Promise<Response> {
  return proxyApiRequest(request, TAGS_API_PATH);
}
