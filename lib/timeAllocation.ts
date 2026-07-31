import { addDays, getIsoWeekId, getWeekDateKeys, parseDateKey, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

type TimeAllocationCategoryRecord = Awaited<ReturnType<typeof prisma.timeAllocationCategory.findFirst>>;
type DailyTimeAllocationRecord = Awaited<ReturnType<typeof prisma.dailyTimeAllocation.findFirst>>;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function asDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clampMinutes(value: number) {
  return Math.max(0, Math.round(value));
}

function allocateMinutesFromWeights(weights: number[], totalMinutes: number) {
  const safeTotal = clampMinutes(totalMinutes);
  const normalized = weights.map((weight) => Math.max(0, weight));
  const weightSum = normalized.reduce((sum, weight) => sum + weight, 0);
  if (safeTotal === 0 || weightSum === 0) return normalized.map(() => 0);

  const raw = normalized.map((weight) => (weight / weightSum) * safeTotal);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = safeTotal - floors.reduce((sum, value) => sum + value, 0);

  const rankedRemainders = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const item of rankedRemainders) {
    if (remainder <= 0) break;
    floors[item.index] += 1;
    remainder -= 1;
  }

  return floors;
}

export async function ensureDefaultTimeAllocation(userId: string) {
  await Promise.resolve(userId);
}

export function computePortfolioMetrics(
  rows: Array<{
    targetWeight: number;
    actualWeight: number;
    expectedReturn: number;
    risk: number;
    beta: number;
  }>
) {
  const targetReturn = rows.reduce((sum, row) => sum + (row.targetWeight / 100) * row.expectedReturn, 0);
  const actualReturn = rows.reduce((sum, row) => sum + (row.actualWeight / 100) * row.expectedReturn, 0);
  const targetRisk = Math.sqrt(rows.reduce((sum, row) => sum + (row.targetWeight / 100) ** 2 * row.risk ** 2, 0));
  const actualRisk = Math.sqrt(rows.reduce((sum, row) => sum + (row.actualWeight / 100) ** 2 * row.risk ** 2, 0));
  const beta = rows.reduce((sum, row) => sum + (row.actualWeight / 100) * row.beta, 0);
  const riskFree = 20;
  const lifeMarketPremium = 55;
  const capmExpectedReturn = riskFree + beta * lifeMarketPremium;

  return {
    targetReturn: clamp(targetReturn),
    actualReturn: clamp(actualReturn),
    targetRisk: clamp(targetRisk),
    actualRisk: clamp(actualRisk),
    beta: Number(beta.toFixed(2)),
    capmExpectedReturn: clamp(capmExpectedReturn),
    sharpeLike: actualRisk === 0 ? 0 : Number(((actualReturn - riskFree) / actualRisk).toFixed(2))
  };
}

export async function getTimeAllocationData(userId: string, dateKey = toDateKey()) {
  await ensureDefaultTimeAllocation(userId);
  const weekDays = getWeekDateKeys(getIsoWeekId(dateKey));
  const [categories, dayAllocations, weekAllocations, planningContext] = await Promise.all([
    prisma.timeAllocationCategory.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.dailyTimeAllocation.findMany({
      where: { userId, date: parseDateKey(dateKey) }
    }),
    prisma.dailyTimeAllocation.findMany({
      where: {
        userId,
        date: { gte: parseDateKey(weekDays[0]), lt: parseDateKey(addDays(weekDays[6], 1)) }
      }
    }),
    prisma.dailyPlanningContext.findUnique({
      where: { userId_date: { userId, date: parseDateKey(dateKey) } }
    })
  ]);
  const dayByCategory = new Map<string, NonNullable<DailyTimeAllocationRecord>>(
    dayAllocations.map((allocation: NonNullable<DailyTimeAllocationRecord>) => [allocation.categoryId, allocation])
  );
  const weekByCategory = new Map<string, number>();
  for (const allocation of weekAllocations as NonNullable<DailyTimeAllocationRecord>[]) {
    weekByCategory.set(allocation.categoryId, (weekByCategory.get(allocation.categoryId) ?? 0) + allocation.actualMinutes);
  }
  const dayTotal = (dayAllocations as NonNullable<DailyTimeAllocationRecord>[]).reduce((sum: number, allocation) => sum + allocation.actualMinutes, 0);
  const weekTotal = (weekAllocations as NonNullable<DailyTimeAllocationRecord>[]).reduce((sum: number, allocation) => sum + allocation.actualMinutes, 0);
  const dayBudgetMinutes = planningContext?.dayBudgetMinutes ?? 12 * 60;
  const autoPlannedMinutesByCategory = allocateMinutesFromWeights(
    (categories as NonNullable<TimeAllocationCategoryRecord>[]).map((category) => category.targetWeight),
    dayBudgetMinutes
  );

  const rows = (categories as NonNullable<TimeAllocationCategoryRecord>[]).map((category, index: number) => {
    const allocation = dayByCategory.get(category.id);
    const actualMinutes = allocation?.actualMinutes ?? 0;
    const autoPlannedMinutes = autoPlannedMinutesByCategory[index] ?? 0;
    const plannedMinutesManual = allocation?.plannedMinutesManual ?? false;
    const plannedMinutesStored = allocation?.plannedMinutes ?? 0;
    const plannedMinutes = plannedMinutesManual ? plannedMinutesStored : autoPlannedMinutes;
    const actualWeight = dayTotal === 0 ? 0 : Math.round((actualMinutes / dayTotal) * 100);
    const weekActualMinutes = weekByCategory.get(category.id) ?? 0;
    const weekWeight = weekTotal === 0 ? 0 : Math.round((weekActualMinutes / weekTotal) * 100);
    return {
      id: category.id,
      name: category.name,
      objective: category.objective ?? "",
      targetWeight: category.targetWeight,
      actualWeight,
      weekWeight,
      plannedMinutes,
      autoPlannedMinutes,
      plannedMinutesStored,
      plannedMinutesManual,
      actualMinutes,
      weekActualMinutes,
      expectedReturn: category.expectedReturn,
      risk: category.risk,
      beta: category.beta,
      color: category.color,
      active: category.active
    };
  });

  const plannedMinutesTotal = rows.reduce((sum: number, row) => sum + row.plannedMinutes, 0);
  const plannedMinutesAutoTotal = rows.reduce((sum: number, row) => sum + row.autoPlannedMinutes, 0);

  return {
    date: dateKey,
    weekId: getIsoWeekId(dateKey),
    dayBudgetMinutes,
    targetWeightTotal: rows.reduce((sum: number, row) => sum + row.targetWeight, 0),
    plannedMinutesTotal,
    plannedMinutesAutoTotal,
    actualMinutesTotal: dayTotal,
    weekActualMinutesTotal: weekTotal,
    remainingBudgetMinutes: Math.max(0, dayBudgetMinutes - plannedMinutesTotal),
    overBudgetMinutes: Math.max(0, plannedMinutesTotal - dayBudgetMinutes),
    hasManualPlanOverrides: rows.some((row) => row.plannedMinutesManual),
    rows,
    metrics: computePortfolioMetrics(rows)
  };
}

export async function upsertDailyAllocation({
  userId,
  dateKey,
  categoryId,
  plannedMinutes,
  plannedMinutesManual,
  actualMinutes,
  note
}: {
  userId: string;
  dateKey: string;
  categoryId: string;
  plannedMinutes?: number;
  plannedMinutesManual?: boolean;
  actualMinutes?: number;
  note?: string;
}) {
  return prisma.dailyTimeAllocation.upsert({
    where: { userId_categoryId_date: { userId, categoryId, date: parseDateKey(dateKey) } },
    create: {
      userId,
      categoryId,
      date: parseDateKey(dateKey),
      plannedMinutes: clampMinutes(plannedMinutes ?? 0),
      plannedMinutesManual: plannedMinutesManual ?? false,
      actualMinutes: actualMinutes ?? 0,
      note
    },
    update: {
      plannedMinutes: plannedMinutes == null ? undefined : clampMinutes(plannedMinutes),
      plannedMinutesManual: plannedMinutesManual ?? undefined,
      actualMinutes: actualMinutes ?? undefined,
      note: note ?? undefined
    }
  });
}

export async function upsertDayBudget({
  userId,
  dateKey,
  dayBudgetMinutes
}: {
  userId: string;
  dateKey: string;
  dayBudgetMinutes: number;
}) {
  return prisma.dailyPlanningContext.upsert({
    where: { userId_date: { userId, date: parseDateKey(dateKey) } },
    create: {
      userId,
      date: parseDateKey(dateKey),
      dayBudgetMinutes: clampMinutes(dayBudgetMinutes)
    },
    update: {
      dayBudgetMinutes: clampMinutes(dayBudgetMinutes)
    }
  });
}

export function serializeAllocationDate(date: Date) {
  return asDateKey(date);
}
