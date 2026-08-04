import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const THINKING_NOTES_API_PATH = "/api/thinking-notes";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, THINKING_NOTES_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, THINKING_NOTES_API_PATH);
}

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, THINKING_NOTES_API_PATH);
}

export function DELETE(request: Request): Promise<Response> {
  return proxyApiRequest(request, THINKING_NOTES_API_PATH);
}
