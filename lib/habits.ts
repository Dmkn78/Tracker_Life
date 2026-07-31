import { addDays, parseDateKey, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function ensureDefaultHabits(userId: string) {
  await Promise.resolve(userId);
}

export async function getHabitTrackerData(userId: string, date = toDateKey()) {
  await ensureDefaultHabits(userId);
  const [habits, checkins, routineBlocks, recentCheckins] = await Promise.all([
    prisma.habit.findMany({ where: { userId, active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.habitCheckin.findMany({ where: { userId, date: parseDateKey(date) } }),
    prisma.routineBlock.findMany({ where: { userId, active: true, dayType: "school_day" }, orderBy: { sortOrder: "asc" } }),
    prisma.habitCheckin.findMany({
      where: { userId, date: { gte: parseDateKey(addDays(date, -6)), lte: parseDateKey(date) } },
      orderBy: { date: "asc" }
    })
  ]);
  const checkinByHabit = new Map(checkins.map((checkin) => [checkin.habitId, checkin]));
  const completedToday = checkins.filter((checkin) => checkin.status === "done").length;
  const sevenDayPossible = habits.length * 7;
  const sevenDayDone = recentCheckins.filter((checkin) => checkin.status === "done").length;

  return {
    date,
    habits: habits.map((habit) => {
      const checkin = checkinByHabit.get(habit.id);
      return {
        id: habit.id,
        name: habit.name,
        category: habit.category,
        description: habit.description,
        targetTime: habit.targetTime,
        defaultExpectedMinutes: habit.defaultExpectedMinutes,
        sortOrder: habit.sortOrder,
        source: habit.source,
        checkin: checkin
          ? {
              id: checkin.id,
              status: checkin.status,
              actualMinutes: checkin.actualMinutes,
              note: checkin.note ?? ""
            }
          : {
              id: null,
              status: "planned",
              actualMinutes: 0,
              note: ""
            }
      };
    }),
    routineBlocks: routineBlocks.map((block) => ({
      id: block.id,
      habitId: block.habitId,
      dayType: block.dayType,
      label: block.label,
      startTime: block.startTime,
      endTime: block.endTime,
      sortOrder: block.sortOrder
    })),
    metrics: {
      completedToday,
      totalToday: habits.length,
      completionRateToday: habits.length === 0 ? 0 : Math.round((completedToday / habits.length) * 100),
      sevenDayCompletionRate: sevenDayPossible === 0 ? 0 : Math.round((sevenDayDone / sevenDayPossible) * 100)
    }
  };
}

export async function upsertHabitCheckin({
  userId,
  habitId,
  date,
  status,
  actualMinutes,
  note
}: {
  userId: string;
  habitId: string;
  date: string;
  status?: string;
  actualMinutes?: number;
  note?: string;
}) {
  return prisma.habitCheckin.upsert({
    where: { userId_habitId_date: { userId, habitId, date: parseDateKey(date) } },
    create: {
      userId,
      habitId,
      date: parseDateKey(date),
      status: status ?? "planned",
      actualMinutes: actualMinutes ?? 0,
      note
    },
    update: {
      status: status ?? undefined,
      actualMinutes: actualMinutes ?? undefined,
      note: note ?? undefined
    }
  });
}

export function serializeHabitDate(date: Date) {
  return dateKey(date);
}
