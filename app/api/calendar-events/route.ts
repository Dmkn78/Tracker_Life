import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const CALENDAR_EVENTS_API_PATH = "/api/calendar-events";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, CALENDAR_EVENTS_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, CALENDAR_EVENTS_API_PATH);
}

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, CALENDAR_EVENTS_API_PATH);
}

export function DELETE(request: Request): Promise<Response> {
  return proxyApiRequest(request, CALENDAR_EVENTS_API_PATH);
}
