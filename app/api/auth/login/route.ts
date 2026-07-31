import { authenticateAccessKey, createSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { accessKey?: string };
  const user = await authenticateAccessKey(body.accessKey ?? "");
  if (!user) return Response.json({ error: "Invalid access key" }, { status: 401 });
  await createSessionCookie(user.id);
  return Response.json({ ok: true });
}
