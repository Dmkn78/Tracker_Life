import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

const EMOTIONAL_REVIEWS_API_PATH = "/api/emotional-reviews";

export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, EMOTIONAL_REVIEWS_API_PATH);
}

export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, EMOTIONAL_REVIEWS_API_PATH);
}
