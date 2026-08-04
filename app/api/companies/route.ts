import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const COMPANIES_API_PATH = "/api/companies";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, COMPANIES_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, COMPANIES_API_PATH);
}

export function PATCH(request: Request): Promise<Response> {
  return proxyApiRequest(request, COMPANIES_API_PATH);
}

export function DELETE(request: Request): Promise<Response> {
  return proxyApiRequest(request, COMPANIES_API_PATH);
}
