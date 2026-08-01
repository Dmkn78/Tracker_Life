import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const SETTINGS_API_PATH = "/api/settings";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, SETTINGS_API_PATH);
}

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, SETTINGS_API_PATH);
}
