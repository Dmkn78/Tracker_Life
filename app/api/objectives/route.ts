import { ObjectiveHorizon, ObjectiveKind, ObjectivePriority, ObjectiveStatus, WeeklyPlanCategory } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { getIsoWeekId, parseDateKey, toDateKey } from "@/lib/dates";
import {
  bootstrapObjectivesDemo,
  getObjectivesData,
  syncObjectiveTasks
} from "@/lib/objectives";
import { prisma } from "@/lib/prisma";

function asEnum<T extends string>(value: string | null | undefined, fallback: T) {
  return (String(value ?? fallback).toUpperCase() as T);
}

function normalizeWeekId(body: { horizon?: string; targetDate?: string | null; weekId?: string | null }) {
  if (body.weekId) return body.weekId;
  if ((body.horizon ?? "").toLowerCase() === "week" && body.targetDate) return getIsoWeekId(body.targetDate);
  if ((body.horizon ?? "").toLowerCase() === "week") return getIsoWeekId();
  return null;
}

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const weekId = url.searchParams.get("week_id") ?? getIsoWeekId();
  return Response.json(await getObjectivesData(user.id, weekId));
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();

  if (body.kind === "bootstrap_demo") {
    const data = await bootstrapObjectivesDemo(user.id, body.weekId ?? getIsoWeekId());
    return Response.json(data);
  }

  if (body.kind === "weekly_block") {
    const block = await prisma.weeklyPlanBlock.create({
      data: {
        userId: user.id,
        objectiveId: body.objectiveId || null,
        title: body.title || "Planned block",
        category: asEnum<WeeklyPlanCategory>(body.category, "WORK"),
        date: parseDateKey(body.date ?? toDateKey()),
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        durationMinutes: body.durationMinutes ?? 60,
        flexible: body.flexible ?? false,
        note: body.note || null
      }
    });
    return Response.json({
      block: {
        id: block.id
      },
      data: await getObjectivesData(user.id, body.weekId ?? getIsoWeekId(block.date.toISOString().slice(0, 10)))
    });
  }

  const objective = await prisma.objective.create({
    data: {
      userId: user.id,
      parentId: body.parentId || null,
      title: body.title?.trim() || defaultObjectiveTitle(body.kind),
      summary: body.summary || null,
      nextAction: body.nextAction || null,
      kind: asEnum<ObjectiveKind>(body.kind, "OBJECTIVE"),
      horizon: asEnum<ObjectiveHorizon>(body.horizon, "WEEK"),
      status: asEnum<ObjectiveStatus>(body.status, "PLANNED"),
      priority: asEnum<ObjectivePriority>(body.priority, "MEDIUM"),
      targetDate: body.targetDate ? parseDateKey(body.targetDate) : null,
      weekId: normalizeWeekId(body),
      color: body.color || "#8da2fb",
      sortOrder: body.sortOrder ?? 0
    }
  });
  await syncObjectiveTasks(user.id, objective.id, Array.isArray(body.linkedTaskIds) ? body.linkedTaskIds : []);
  return Response.json({
    objective: { id: objective.id },
    data: await getObjectivesData(user.id, body.weekId ?? normalizeWeekId(body))
  });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();

  if (body.kind === "weekly_block") {
    const existing = await prisma.weeklyPlanBlock.findFirst({ where: { id: body.id, userId: user.id } });
    if (!existing) return Response.json({ error: "Weekly block not found" }, { status: 404 });
    const block = await prisma.weeklyPlanBlock.update({
      where: { id: existing.id },
      data: {
        objectiveId: body.objectiveId === undefined ? undefined : body.objectiveId || null,
        title: body.title ?? undefined,
        category: body.category ? asEnum<WeeklyPlanCategory>(body.category, "WORK") : undefined,
        date: body.date ? parseDateKey(body.date) : undefined,
        startTime: body.startTime === undefined ? undefined : body.startTime || null,
        endTime: body.endTime === undefined ? undefined : body.endTime || null,
        durationMinutes: body.durationMinutes ?? undefined,
        flexible: body.flexible ?? undefined,
        note: body.note === undefined ? undefined : body.note || null
      }
    });
    return Response.json({
      block: { id: block.id },
      data: await getObjectivesData(user.id, body.weekId ?? getIsoWeekId(block.date.toISOString().slice(0, 10)))
    });
  }

  const existing = await prisma.objective.findFirst({ where: { id: body.id, userId: user.id } });
  if (!existing) return Response.json({ error: "Objective not found" }, { status: 404 });
  if (body.parentId && body.parentId === existing.id) {
    return Response.json({ error: "An objective cannot be its own parent." }, { status: 400 });
  }
  const objective = await prisma.objective.update({
    where: { id: existing.id },
    data: {
      parentId: body.parentId === undefined ? undefined : body.parentId || null,
      title: body.title ?? undefined,
      summary: body.summary === undefined ? undefined : body.summary || null,
      nextAction: body.nextAction === undefined ? undefined : body.nextAction || null,
      kind: body.kind ? asEnum<ObjectiveKind>(body.kind, existing.kind) : undefined,
      horizon: body.horizon ? asEnum<ObjectiveHorizon>(body.horizon, existing.horizon) : undefined,
      status: body.status ? asEnum<ObjectiveStatus>(body.status, existing.status) : undefined,
      priority: body.priority ? asEnum<ObjectivePriority>(body.priority, existing.priority) : undefined,
      targetDate: body.targetDate === undefined ? undefined : body.targetDate ? parseDateKey(body.targetDate) : null,
      weekId: body.weekId === undefined ? undefined : body.weekId || null,
      color: body.color ?? undefined,
      sortOrder: body.sortOrder ?? undefined,
      archived: body.archived ?? undefined
    }
  });
  if (Array.isArray(body.linkedTaskIds)) {
    await syncObjectiveTasks(user.id, objective.id, body.linkedTaskIds);
  }
  return Response.json({
    objective: { id: objective.id },
    data: await getObjectivesData(user.id, body.weekId ?? objective.weekId ?? getIsoWeekId())
  });
}

export async function DELETE(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const kind = url.searchParams.get("kind") ?? "objective";
  const weekId = url.searchParams.get("week_id") ?? getIsoWeekId();
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  if (kind === "weekly_block") {
    const existing = await prisma.weeklyPlanBlock.findFirst({ where: { id, userId: user.id } });
    if (!existing) return Response.json({ error: "Weekly block not found" }, { status: 404 });
    await prisma.weeklyPlanBlock.delete({ where: { id: existing.id } });
    return Response.json(await getObjectivesData(user.id, weekId));
  }

  const existing = await prisma.objective.findFirst({ where: { id, userId: user.id } });
  if (!existing) return Response.json({ error: "Objective not found" }, { status: 404 });

  await prisma.task.updateMany({
    where: { userId: user.id, objectiveId: existing.id },
    data: { objectiveId: null }
  });
  await prisma.weeklyPlanBlock.updateMany({
    where: { userId: user.id, objectiveId: existing.id },
    data: { objectiveId: null }
  });
  await prisma.objective.update({
    where: { id: existing.id },
    data: { archived: true }
  });

  return Response.json(await getObjectivesData(user.id, weekId));
}

function defaultObjectiveTitle(kind?: string) {
  if ((kind ?? "").toLowerCase() === "project") return "New project";
  if ((kind ?? "").toLowerCase() === "milestone") return "New milestone";
  return "New objective";
}
