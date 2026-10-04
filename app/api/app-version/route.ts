export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ version: process.env.NEXT_PUBLIC_WEBSITE_VERSION ?? "" }, {
    headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" }
  });
}
