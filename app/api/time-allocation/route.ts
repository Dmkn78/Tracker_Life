import { requireApiUser } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getTimeAllocationData, upsertDailyAllocation, upsertDayBudget } from "@/lib/timeAllocation";

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? toDateKey();
  return Response.json(await getTimeAllocationData(user.id, date));
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();
  const category = await prisma.timeAllocationCategory.create({
    data: {
      userId: user.id,
      name: body.name || "New allocation",
      objective: body.objective ?? null,
      targetWeight: body.targetWeight ?? 0,
      expectedReturn: body.expectedReturn ?? 50,
      risk: body.risk ?? 50,
      beta: body.beta ?? 1,
      color: body.color ?? "#22d3ee"
    }
  });
  return Response.json({ category });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();

  if (body.kind === "day_budget") {
    await upsertDayBudget({
      userId: user.id,
      dateKey: body.date ?? toDateKey(),
      dayBudgetMinutes: body.dayBudgetMinutes ?? 12 * 60
    });
    return Response.json(await getTimeAllocationData(user.id, body.date ?? toDateKey()));
  }

  if (body.kind === "allocation") {
    await upsertDailyAllocation({
      userId: user.id,
      dateKey: body.date ?? toDateKey(),
      categoryId: body.categoryId,
      plannedMinutes: body.plannedMinutes,
      plannedMinutesManual: body.plannedMinutesManual,
      actualMinutes: body.actualMinutes,
      note: body.note
    });
    return Response.json(await getTimeAllocationData(user.id, body.date ?? toDateKey()));
  }

  const existing = await prisma.timeAllocationCategory.findFirst({ where: { id: body.id, userId: user.id } });
  if (!existing) return Response.json({ error: "Allocation category not found" }, { status: 404 });
  const category = await prisma.timeAllocationCategory.update({
    where: { id: existing.id },
    data: {
      name: body.name ?? undefined,
      objective: body.objective ?? undefined,
      targetWeight: body.targetWeight ?? undefined,
      expectedReturn: body.expectedReturn ?? undefined,
      risk: body.risk ?? undefined,
      beta: body.beta ?? undefined,
      color: body.color ?? undefined,
      active: body.active ?? undefined
    }
  });
  return Response.json({ category });
}

export async function DELETE(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing category id" }, { status: 400 });

  const existing = await prisma.timeAllocationCategory.findFirst({ where: { id, userId: user.id } });
  if (!existing) return Response.json({ error: "Allocation category not found" }, { status: 404 });

  await prisma.timeAllocationCategory.update({
    where: { id: existing.id },
    data: { active: false }
  });

  return Response.json(await getTimeAllocationData(user.id, url.searchParams.get("date") ?? toDateKey()));
}
