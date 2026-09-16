import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

export async function POST(request: NextRequest): Promise<Response> {
  return proxyApiRequest(request, "/api/tasks/capture");
}
