import { CalendarEventType, CalendarImpact } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { addDays, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { recomputeAroundDate } from "@/lib/scoring";

function serializeEvent(event: Awaited<ReturnType<typeof prisma.calendarEvent.findFirst>>) {
  if (!event) return null;
  return {
    ...event,
    type: event.type.toLowerCase(),
    impact: event.impact.toLowerCase(),
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? toDateKey();
  const to = url.searchParams.get("to") ?? addDays(from, 30);
  const events = await prisma.calendarEvent.findMany({
    where: {
      userId: user.id,
      start: { gte: new Date(`${from}T00:00:00.000Z`), lt: new Date(`${to}T23:59:59.999Z`) }
    },
    orderBy: { start: "asc" }
  });
  return Response.json({ events: events.map(serializeEvent) });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();
  const start = new Date(body.start);
  const event = await prisma.calendarEvent.create({
    data: {
      userId: user.id,
      title: body.title || "Untitled event",
      type: ((body.type ?? "PERSONAL") as string).toUpperCase() as CalendarEventType,
      start,
      end: new Date(body.end || start.getTime() + 60 * 60_000),
      impact: ((body.impact ?? "MEDIUM") as string).toUpperCase() as CalendarImpact,
      expectedStress: body.expectedStress ?? 50,
      expectedPreparationLoad: body.expectedPreparationLoad ?? 50
    }
  });
  await recomputeAroundDate(user.id, event.start.toISOString().slice(0, 10));
  return Response.json({ event: serializeEvent(event) });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();
  const existing = await prisma.calendarEvent.findFirst({ where: { id: body.id, userId: user.id } });
  if (!existing) return Response.json({ error: "Event not found" }, { status: 404 });

  const event = await prisma.calendarEvent.update({
    where: { id: existing.id },
    data: {
      title: body.title ?? undefined,
      type: body.type ? (String(body.type).toUpperCase() as CalendarEventType) : undefined,
      start: body.start ? new Date(body.start) : undefined,
      end: body.end ? new Date(body.end) : undefined,
      impact: body.impact ? (String(body.impact).toUpperCase() as CalendarImpact) : undefined,
      expectedStress: body.expectedStress ?? undefined,
      expectedPreparationLoad: body.expectedPreparationLoad ?? undefined
    }
  });
  await recomputeAroundDate(user.id, existing.start.toISOString().slice(0, 10));
  await recomputeAroundDate(user.id, event.start.toISOString().slice(0, 10));
  return Response.json({ event: serializeEvent(event) });
}

export async function DELETE(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing event id" }, { status: 400 });

  const existing = await prisma.calendarEvent.findFirst({ where: { id, userId: user.id } });
  if (!existing) return Response.json({ error: "Event not found" }, { status: 404 });
  await prisma.calendarEvent.delete({ where: { id: existing.id } });
  await recomputeAroundDate(user.id, existing.start.toISOString().slice(0, 10));
  return Response.json({ ok: true });
}
