import { TaskImportance, TaskStatus } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { addDays, parseDateKey, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { recomputeAroundDate } from "@/lib/scoring";

function serializeTask(task: (Awaited<ReturnType<typeof prisma.task.findFirst>> & { objective?: { title: string } | null }) | null) {
  if (!task) return null;
  return {
    ...task,
    date: task.date.toISOString().slice(0, 10),
    importance: task.importance.toLowerCase(),
    status: task.status.toLowerCase(),
    objectiveId: task.objectiveId ?? null,
    objectiveTitle: task.objective?.title ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "today";
  const dateKey =
    scope === "tomorrow" ? addDays(toDateKey(), 1) : url.searchParams.get("date") ?? toDateKey();
  const tasks = await prisma.task.findMany({
    where: scope === "all" ? { userId: user.id } : { userId: user.id, date: parseDateKey(dateKey) },
    include: { objective: { select: { title: true } } },
    orderBy: [{ date: "asc" }, { status: "asc" }, { importance: "desc" }, { createdAt: "asc" }]
  });
  return Response.json({ tasks: tasks.map(serializeTask) });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();
  const dateKey = body.date ?? toDateKey();
  const titles =
    Array.isArray(body.titles) && body.titles.length > 0
      ? body.titles.map((title: unknown) => String(title ?? "").trim()).filter(Boolean)
      : [String(body.title || "Untitled task").trim()].filter(Boolean);
  const tasks = await prisma.$transaction(
    titles.map((title: string) =>
      prisma.task.create({
        data: {
          userId: user.id,
          title,
          date: parseDateKey(dateKey),
          objectiveId: body.objectiveId || null,
          importance: ((body.importance ?? "MEDIUM") as string).toUpperCase() as TaskImportance,
          productive: body.productive ?? true,
          estimatedMinutes: body.estimatedMinutes ?? 0,
          completionPercent: body.completionPercent ?? 0,
          status: ((body.status ?? "PLANNED") as string).toUpperCase() as TaskStatus
        },
        include: { objective: { select: { title: true } } }
      })
    )
  );
  await recomputeAroundDate(user.id, dateKey);
  return Response.json({ task: serializeTask(tasks[0]), tasks: tasks.map(serializeTask) });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();
  const existing = await prisma.task.findFirst({ where: { id: body.id, userId: user.id } });
  if (!existing) return Response.json({ error: "Task not found" }, { status: 404 });
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      title: body.title ?? undefined,
      date: body.date ? parseDateKey(body.date) : undefined,
      objectiveId: body.objectiveId === undefined ? undefined : body.objectiveId || null,
      importance: body.importance ? (String(body.importance).toUpperCase() as TaskImportance) : undefined,
      productive: body.productive ?? undefined,
      estimatedMinutes: body.estimatedMinutes ?? undefined,
      completionPercent: body.completionPercent ?? undefined,
      status: body.status ? (String(body.status).toUpperCase() as TaskStatus) : undefined
    },
    include: { objective: { select: { title: true } } }
  });
  await recomputeAroundDate(user.id, task.date.toISOString().slice(0, 10));
  return Response.json({ task: serializeTask(task) });
}
