import { requireApiUser } from "@/lib/auth";
import { getIsoWeekId } from "@/lib/dates";
import { generateWeeklyReport } from "@/lib/reports";

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const weekId = url.searchParams.get("week_id") ?? getIsoWeekId();
  const report = await generateWeeklyReport(user.id, weekId);
  return Response.json(report, {
    headers: {
      "Content-Disposition": `attachment; filename="life-regime-${weekId}.json"`
    }
  });
}
