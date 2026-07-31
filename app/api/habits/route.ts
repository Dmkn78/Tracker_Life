import { requireApiUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { getHabitTrackerData, upsertHabitCheckin } from "@/lib/habits";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? toDateKey();
  return Response.json(await getHabitTrackerData(user.id, date));
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();
  const habit = await prisma.habit.create({
    data: {
      userId: user.id,
      name: body.name || "New habit",
      category: body.category ?? "routine",
      description: body.description ?? null,
      targetTime: body.targetTime ?? null,
      defaultExpectedMinutes: body.defaultExpectedMinutes ?? 0,
      sortOrder: body.sortOrder ?? 99,
      source: "manual"
    }
  });
  return Response.json({ habit });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();

  if (body.kind === "checkin") {
    await upsertHabitCheckin({
      userId: user.id,
      habitId: body.habitId,
      date: body.date ?? toDateKey(),
      status: body.status,
      actualMinutes: body.actualMinutes,
      note: body.note
    });
    return Response.json(await getHabitTrackerData(user.id, body.date ?? toDateKey()));
  }

  const existing = await prisma.habit.findFirst({ where: { id: body.id, userId: user.id } });
  if (!existing) return Response.json({ error: "Habit not found" }, { status: 404 });
  const habit = await prisma.habit.update({
    where: { id: existing.id },
    data: {
      name: body.name ?? undefined,
      category: body.category ?? undefined,
      description: body.description ?? undefined,
      targetTime: body.targetTime ?? undefined,
      defaultExpectedMinutes: body.defaultExpectedMinutes ?? undefined,
      sortOrder: body.sortOrder ?? undefined,
      active: body.active ?? undefined
    }
  });
  return Response.json({ habit });
}

export async function DELETE(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing habit id" }, { status: 400 });

  const existing = await prisma.habit.findFirst({ where: { id, userId: user.id } });
  if (!existing) return Response.json({ error: "Habit not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.routineBlock.updateMany({ where: { userId: user.id, habitId: existing.id }, data: { active: false } }),
    prisma.habit.update({ where: { id: existing.id }, data: { active: false } })
  ]);

  return Response.json(await getHabitTrackerData(user.id, url.searchParams.get("date") ?? toDateKey()));
}
