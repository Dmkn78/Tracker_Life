import { proxyApiRequest } from "@/lib/server/proxyApiRequest";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const { jobId } = await context.params;
  return proxyApiRequest(request, `/api/transcription-jobs/${encodeURIComponent(jobId)}`);
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  return GET(request, context);
}
