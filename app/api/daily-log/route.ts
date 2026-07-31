import { DailyLogStatus } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { parseDateKey, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { recomputeAroundDate, serializeDailyLog } from "@/lib/scoring";
import { getCalendarContext, getTodoMetrics } from "@/lib/todoMetrics";

function statusFromInput(value: string | undefined) {
  const upper = (value ?? "DRAFT").toUpperCase();
  return Object.values(DailyLogStatus).includes(upper as DailyLogStatus)
    ? (upper as DailyLogStatus)
    : DailyLogStatus.DRAFT;
}

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const url = new URL(request.url);
  const dateKey = url.searchParams.get("date") ?? toDateKey();
  const [log, todo, calendar] = await Promise.all([
    prisma.dailyLog.findUnique({ where: { userId_date: { userId: user.id, date: parseDateKey(dateKey) } } }),
    getTodoMetrics(user.id, dateKey),
    getCalendarContext(user.id, dateKey)
  ]);
  return Response.json({
    log: serializeDailyLog(log),
    todoMetrics: todo.metrics,
    calendarContext: calendar
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();
  const dateKey = body.date ?? toDateKey();
  const status = statusFromInput(body.status);
  const sleepIntentClickedAt = body.sleepIntentClickedAt ? new Date(body.sleepIntentClickedAt) : undefined;
  const estimatedSleepDelayMin = body.estimatedSleepDelayMin ?? undefined;
  const estimatedSleepStart =
    sleepIntentClickedAt && estimatedSleepDelayMin
      ? new Date(sleepIntentClickedAt.getTime() + estimatedSleepDelayMin * 60_000)
      : undefined;

  const data = {
    status,
    energy: body.energy ?? null,
    productivity: body.productivity ?? null,
    startFriction: body.startFriction ?? null,
    calorieTarget: body.calorieTarget ?? null,
    caloriePercent: body.caloriePercent ?? null,
    trainingDone: body.trainingDone ?? null,
    mentalFatigue: body.mentalFatigue ?? null,
    physicalFatigue: body.physicalFatigue ?? null,
    focusQuality: body.focusQuality ?? null,
    workTimeMinutes: body.workTimeMinutes ?? null,
    distractionTimeMinutes: body.distractionTimeMinutes ?? null,
    avoidedImportantTask: body.avoidedImportantTask ?? null,
    mainBlocker: body.mainBlocker ?? null,
    improvementTomorrow: body.improvementTomorrow ?? null,
    sleepIntentClickedAt: sleepIntentClickedAt ?? null,
    estimatedSleepDelayMin: estimatedSleepDelayMin ?? null,
    estimatedSleepStart: estimatedSleepStart ?? null,
    textSummary: body.textSummary ?? null,
    voiceTranscript: body.voiceTranscript ?? null,
    submittedAt: status === "SUBMITTED" ? new Date() : undefined
  };

  await prisma.dailyLog.upsert({
    where: { userId_date: { userId: user.id, date: parseDateKey(dateKey) } },
    create: { userId: user.id, date: parseDateKey(dateKey), ...data },
    update: data
  });
  const updated = await recomputeAroundDate(user.id, dateKey);
  const [todo, calendar] = await Promise.all([getTodoMetrics(user.id, dateKey), getCalendarContext(user.id, dateKey)]);
  return Response.json({
    log: serializeDailyLog(updated),
    todoMetrics: todo.metrics,
    calendarContext: calendar
  });
}
