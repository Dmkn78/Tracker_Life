import { prisma } from "@/lib/prisma";
import { getIsoWeekId } from "@/lib/dates";
import { buildWeeklyJsonExport } from "@/lib/metrics";

export async function generateWeeklyReport(userId: string, weekId = getIsoWeekId()) {
  const report = await buildWeeklyJsonExport(userId, weekId);

  await prisma.weeklyReport.upsert({
    where: { userId_weekId: { userId, weekId } },
    create: { userId, weekId, content: report },
    update: { content: report }
  });

  return report;
}
