import { ObjectiveHorizon, ObjectiveKind, ObjectivePriority, ObjectiveStatus, TaskStatus, WeeklyPlanCategory } from "@prisma/client";
import { addDays, getIsoWeekId, getWeekDateKeys, parseDateKey, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

type ObjectiveRecord = NonNullable<Awaited<ReturnType<typeof prisma.objective.findFirst>>>;
type TaskRecord = NonNullable<Awaited<ReturnType<typeof prisma.task.findFirst>>>;
type WeeklyPlanBlockRecord = NonNullable<Awaited<ReturnType<typeof prisma.weeklyPlanBlock.findFirst>>>;
type CalendarEventRecord = NonNullable<Awaited<ReturnType<typeof prisma.calendarEvent.findFirst>>>;

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lower<T extends string>(value: T) {
  return value.toLowerCase() as Lowercase<T>;
}

function dayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(parseDateKey(dateKey));
}

function dayFullLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(parseDateKey(dateKey));
}

function eventTime(value: Date) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function rankPriority(priority: ObjectivePriority) {
  if (priority === "CRITICAL") return 4;
  if (priority === "HIGH") return 3;
  if (priority === "MEDIUM") return 2;
  return 1;
}

function rankHorizon(horizon: ObjectiveHorizon) {
  if (horizon === "YEAR") return 1;
  if (horizon === "QUARTER") return 2;
  if (horizon === "MONTH") return 3;
  return 4;
}

export function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes === 0) return "0m";
  const days = Math.floor(minutes / (60 * 24));
  const afterDays = minutes - days * 60 * 24;
  const hours = Math.floor(afterDays / 60);
  const rest = afterDays % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

function serializeObjective(objective: ObjectiveRecord) {
  return {
    id: objective.id,
    parentId: objective.parentId,
    title: objective.title,
    summary: objective.summary,
    nextAction: objective.nextAction,
    kind: lower(objective.kind),
    horizon: lower(objective.horizon),
    status: lower(objective.status),
    priority: lower(objective.priority),
    targetDate: objective.targetDate ? toKey(objective.targetDate) : null,
    weekId: objective.weekId,
    color: objective.color,
    sortOrder: objective.sortOrder,
    archived: objective.archived,
    createdAt: objective.createdAt.toISOString(),
    updatedAt: objective.updatedAt.toISOString()
  };
}

function serializeTask(task: TaskRecord, objectiveTitle?: string | null) {
  return {
    id: task.id,
    title: task.title,
    date: toKey(task.date),
    status: lower(task.status),
    importance: lower(task.importance),
    completionPercent: task.completionPercent,
    estimatedMinutes: task.estimatedMinutes,
    objectiveId: task.objectiveId,
    objectiveTitle: objectiveTitle ?? null
  };
}

function serializeBlock(block: WeeklyPlanBlockRecord, objective?: { title: string; color: string } | null) {
  return {
    id: block.id,
    title: block.title,
    date: toKey(block.date),
    category: lower(block.category),
    startTime: block.startTime,
    endTime: block.endTime,
    durationMinutes: block.durationMinutes,
    flexible: block.flexible,
    note: block.note,
    objectiveId: block.objectiveId,
    objectiveTitle: objective?.title ?? null,
    objectiveColor: objective?.color ?? null,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString()
  };
}

function serializeEvent(event: CalendarEventRecord) {
  return {
    id: event.id,
    title: event.title,
    impact: lower(event.impact),
    type: lower(event.type),
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    timeLabel: `${eventTime(event.start)}-${eventTime(event.end)}`
  };
}

function defaultObjectiveTitle(kind: ObjectiveKind) {
  if (kind === "PROJECT") return "New project";
  if (kind === "MILESTONE") return "New milestone";
  return "New objective";
}

function sanitizeWeekId(horizon: ObjectiveHorizon, targetDate?: string | null, explicitWeekId?: string | null) {
  if (horizon === "WEEK" && explicitWeekId) return explicitWeekId;
  if (horizon === "WEEK" && targetDate) return getIsoWeekId(targetDate);
  return explicitWeekId ?? null;
}

export async function syncObjectiveTasks(userId: string, objectiveId: string, linkedTaskIds: string[] = []) {
  const uniqueIds = Array.from(new Set(linkedTaskIds.filter(Boolean)));
  await prisma.task.updateMany({
    where: {
      userId,
      objectiveId,
      id: uniqueIds.length ? { notIn: uniqueIds } : undefined
    },
    data: { objectiveId: null }
  });
  if (uniqueIds.length) {
    await prisma.task.updateMany({
      where: { userId, id: { in: uniqueIds } },
      data: { objectiveId }
    });
  }
}

export async function bootstrapObjectivesDemo(userId: string, weekId = getIsoWeekId()) {
  const existing = await prisma.objective.count({ where: { userId, archived: false } });
  if (existing > 0) return getObjectivesData(userId, weekId);

  const weekDays = getWeekDateKeys(weekId);
  const currentYear = weekDays[0].slice(0, 4);
  const quarter = Math.floor((Number(weekDays[0].slice(5, 7)) - 1) / 3) + 1;
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(parseDateKey(weekDays[0]));

  await prisma.$transaction(async (tx) => {
    const yearObjective = await tx.objective.create({
      data: {
        userId,
        title: `${currentYear} Direction`,
        summary: "The big direction that defines what matters this year.",
        nextAction: "Clarify the one outcome that would make this year feel successful.",
        kind: "OBJECTIVE",
        horizon: "YEAR",
        status: "ACTIVE",
        priority: "HIGH",
        targetDate: parseDateKey(`${currentYear}-12-31`),
        color: "#8da2fb"
      }
    });

    const quarterObjective = await tx.objective.create({
      data: {
        userId,
        parentId: yearObjective.id,
        title: `Q${quarter} focus`,
        summary: "One quarter focus that turns the yearly direction into an actual project.",
        nextAction: "Choose the project that deserves the most energy this quarter.",
        kind: "OBJECTIVE",
        horizon: "QUARTER",
        status: "ACTIVE",
        priority: "HIGH",
        color: "#6aa8ff"
      }
    });

    const monthObjective = await tx.objective.create({
      data: {
        userId,
        parentId: quarterObjective.id,
        title: monthLabel,
        summary: "Concrete monthly objective.",
        nextAction: "Define the deliverable you want finished by month end.",
        kind: "OBJECTIVE",
        horizon: "MONTH",
        status: "ON_TRACK",
        priority: "MEDIUM",
        targetDate: parseDateKey(addDays(weekDays[0], 20)),
        color: "#57c59a"
      }
    });

    const weekObjective = await tx.objective.create({
      data: {
        userId,
        parentId: monthObjective.id,
        title: `Week ${weekId}`,
        summary: "The weekly focus that deserves committed blocks on the calendar.",
        nextAction: "Protect two high-quality work blocks and one review block.",
        kind: "OBJECTIVE",
        horizon: "WEEK",
        status: "ACTIVE",
        priority: "HIGH",
        weekId,
        targetDate: parseDateKey(weekDays[6]),
        color: "#f0c56b"
      }
    });

    const project = await tx.objective.create({
      data: {
        userId,
        parentId: weekObjective.id,
        title: "Primary project",
        summary: "A sample project linked to weekly blocks.",
        nextAction: "Ship one visible step this week.",
        kind: "PROJECT",
        horizon: "WEEK",
        status: "ACTIVE",
        priority: "HIGH",
        weekId,
        color: "#f08b8f"
      }
    });

    await tx.objective.createMany({
      data: [
        {
          userId,
          parentId: project.id,
          title: "Define milestone",
          summary: "Write the exact outcome you want by Friday.",
          kind: "MILESTONE",
          horizon: "WEEK",
          status: "PLANNED",
          priority: "MEDIUM",
          weekId,
          color: "#b78cff"
        },
        {
          userId,
          parentId: project.id,
          title: "Review and adjust",
          summary: "Use Sunday to adjust the plan instead of forcing more output.",
          kind: "MILESTONE",
          horizon: "WEEK",
          status: "PLANNED",
          priority: "LOW",
          weekId,
          color: "#7dd3fc"
        }
      ]
    });

    await tx.weeklyPlanBlock.createMany({
      data: [
        {
          userId,
          objectiveId: project.id,
          title: "Deep work block",
          category: "WORK",
          date: parseDateKey(weekDays[0]),
          startTime: "09:00",
          endTime: "11:00",
          durationMinutes: 120
        },
        {
          userId,
          objectiveId: project.id,
          title: "Admin and planning",
          category: "ADMIN",
          date: parseDateKey(weekDays[2]),
          startTime: "17:00",
          endTime: "18:00",
          durationMinutes: 60
        },
        {
          userId,
          objectiveId: weekObjective.id,
          title: "Weekly review",
          category: "REST",
          date: parseDateKey(weekDays[6]),
          startTime: "18:00",
          endTime: "19:00",
          durationMinutes: 60,
          flexible: true
        }
      ]
    });
  });

  return getObjectivesData(userId, weekId);
}

export async function getObjectivesData(userId: string, weekId = getIsoWeekId()) {
  const weekDays = getWeekDateKeys(weekId);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const taskFrom = addDays(weekStart, -14);
  const taskTo = addDays(weekEnd, 30);

  const [objectives, tasks, blockRows, weekEvents] = await Promise.all([
    prisma.objective.findMany({
      where: { userId, archived: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.task.findMany({
      where: {
        userId,
        date: { gte: parseDateKey(taskFrom), lte: parseDateKey(taskTo) }
      },
      orderBy: [{ date: "asc" }, { importance: "desc" }, { createdAt: "asc" }]
    }),
    prisma.weeklyPlanBlock.findMany({
      where: {
        userId,
        date: { gte: parseDateKey(weekStart), lte: parseDateKey(weekEnd) }
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }, { createdAt: "asc" }]
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        start: { gte: parseDateKey(weekStart), lt: parseDateKey(addDays(weekEnd, 1)) }
      },
      orderBy: { start: "asc" }
    })
  ]);

  const objectiveMap = new Map(objectives.map((objective) => [objective.id, objective]));
  const tasksByObjective = new Map<string, ReturnType<typeof serializeTask>[]>();
  const taskOptions = tasks
    .filter((task) => task.status !== TaskStatus.CANCELLED)
    .map((task) => serializeTask(task, task.objectiveId ? objectiveMap.get(task.objectiveId)?.title ?? null : null));

  for (const task of taskOptions) {
    if (!task.objectiveId) continue;
    const current = tasksByObjective.get(task.objectiveId) ?? [];
    current.push(task);
    tasksByObjective.set(task.objectiveId, current);
  }

  const blockOptions = blockRows
    .map((block) => serializeBlock(block, block.objectiveId ? objectiveMap.get(block.objectiveId) ?? null : null));

  const blocksByObjective = new Map<string, typeof blockOptions>();
  for (const block of blockOptions) {
    if (!block.objectiveId) continue;
    const current = blocksByObjective.get(block.objectiveId) ?? [];
    current.push(block);
    blocksByObjective.set(block.objectiveId, current);
  }

  const childrenByParent = new Map<string | null, typeof objectives>();
  for (const objective of objectives) {
    const key = objective.parentId ?? null;
    const current = childrenByParent.get(key) ?? [];
    current.push(objective);
    childrenByParent.set(key, current);
  }

  type ObjectiveTreeNode = ReturnType<typeof serializeObjective> & {
    completionPercent: number;
    linkedTasksCount: number;
    linkedTasks: ReturnType<typeof serializeTask>[];
    weeklyMinutes: number;
    weeklyBlocksCount: number;
    children: ObjectiveTreeNode[];
  };

  function buildNode(objectiveId: string, trail = new Set<string>()): ObjectiveTreeNode | null {
    const objective = objectiveMap.get(objectiveId);
    if (!objective || trail.has(objectiveId)) return null;
    const nextTrail = new Set(trail);
    nextTrail.add(objectiveId);
    const children = (childrenByParent.get(objective.id) ?? [])
      .sort((a, b) => rankHorizon(a.horizon) - rankHorizon(b.horizon) || rankPriority(b.priority) - rankPriority(a.priority) || a.sortOrder - b.sortOrder)
      .map((child) => buildNode(child.id, nextTrail))
      .filter((child): child is ObjectiveTreeNode => child != null);
    const linkedTasks = tasksByObjective.get(objective.id) ?? [];
    const plannedBlocks = blocksByObjective.get(objective.id) ?? [];
    const completion =
      objective.status === "DONE"
        ? 100
        : linkedTasks.length
          ? Math.round(linkedTasks.reduce((sum, task) => sum + task.completionPercent, 0) / linkedTasks.length)
          : 0;
    return {
      ...serializeObjective(objective),
      completionPercent: completion,
      linkedTasksCount: linkedTasks.length,
      linkedTasks: linkedTasks.slice(0, 4),
      weeklyMinutes: plannedBlocks.reduce((sum, block) => sum + block.durationMinutes, 0),
      weeklyBlocksCount: plannedBlocks.length,
      children
    };
  }

  const tree = (childrenByParent.get(null) ?? [])
    .sort((a, b) => rankHorizon(a.horizon) - rankHorizon(b.horizon) || rankPriority(b.priority) - rankPriority(a.priority) || a.sortOrder - b.sortOrder)
    .map((objective) => buildNode(objective.id))
    .filter(Boolean);

  const weeklyDays = weekDays.map((date, index) => {
    const blocks = blockOptions.filter((block) => block.date === date);
    const events = weekEvents.map(serializeEvent).filter((event) => event.start.slice(0, 10) === date);
    const totalMinutes = blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
    return {
      date,
      label: dayLabel(date),
      fullLabel: dayFullLabel(date),
      isWeekend: index >= 5,
      totalMinutes,
      loadLabel: formatMinutes(totalMinutes),
      blocks,
      events
    };
  });

  const allocationMap = new Map<string, { key: string; objectiveId: string | null; title: string; color: string; minutes: number; days: Set<string>; blocks: number }>();
  for (const block of blockOptions) {
    const key = block.objectiveId ?? `unlinked:${block.category}`;
    const current =
      allocationMap.get(key) ??
      {
        key,
        objectiveId: block.objectiveId,
        title: block.objectiveTitle ?? block.title,
        color: block.objectiveColor ?? "#8da2fb",
        minutes: 0,
        days: new Set<string>(),
        blocks: 0
      };
    current.minutes += block.durationMinutes;
    current.days.add(block.date);
    current.blocks += 1;
    allocationMap.set(key, current);
  }

  const allocation = Array.from(allocationMap.values())
    .map((item) => ({
      key: item.key,
      objectiveId: item.objectiveId,
      title: item.title,
      color: item.color,
      minutes: item.minutes,
      minutesLabel: formatMinutes(item.minutes),
      daysWorked: Array.from(item.days).sort(),
      dayCount: item.days.size,
      blocks: item.blocks
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const dayLoads = weeklyDays.map((day) => ({
    date: day.date,
    label: day.label,
    totalMinutes: day.totalMinutes,
    loadLabel: day.loadLabel,
    blockCount: day.blocks.length,
    eventCount: day.events.length,
    isWeekend: day.isWeekend
  }));

  const totalWeeklyMinutes = dayLoads.reduce((sum, day) => sum + day.totalMinutes, 0);
  const busiestDay = [...dayLoads].sort((a, b) => b.totalMinutes - a.totalMinutes)[0] ?? null;
  const lightestDay = [...dayLoads].sort((a, b) => a.totalMinutes - b.totalMinutes)[0] ?? null;
  const imbalanceMinutes = Math.max(0, (busiestDay?.totalMinutes ?? 0) - (lightestDay?.totalMinutes ?? 0));
  const roots = tree.length;
  const activeObjectives = objectives.filter((objective) => objective.status !== "DONE" && objective.archived === false).length;
  const projectCount = objectives.filter((objective) => objective.kind === "PROJECT").length;
  const horizonCoverage = new Set(objectives.map((objective) => objective.horizon)).size;

  const nextActions = objectives
    .filter((objective) => objective.status !== "DONE")
    .sort((a, b) => rankPriority(b.priority) - rankPriority(a.priority) || rankHorizon(a.horizon) - rankHorizon(b.horizon))
    .slice(0, 6)
    .map((objective) => ({
      id: objective.id,
      title: objective.title,
      nextAction: objective.nextAction ?? "Define the next concrete move.",
      horizon: lower(objective.horizon),
      priority: lower(objective.priority),
      status: lower(objective.status),
      linkedTasksCount: (tasksByObjective.get(objective.id) ?? []).length,
      weeklyMinutes: (blocksByObjective.get(objective.id) ?? []).reduce((sum, block) => sum + block.durationMinutes, 0)
    }));

  return {
    weekId,
    weekDays,
    tree,
    objectives: objectives.map((objective) => {
      const linkedTasks = tasksByObjective.get(objective.id) ?? [];
      const linkedBlocks = blocksByObjective.get(objective.id) ?? [];
      return {
        ...serializeObjective(objective),
        linkedTaskIds: linkedTasks.map((task) => task.id),
        linkedTasksCount: linkedTasks.length,
        weeklyMinutes: linkedBlocks.reduce((sum, block) => sum + block.durationMinutes, 0)
      };
    }),
    taskOptions,
    weeklyBlocks: blockOptions,
    weeklyDays,
    allocation,
    nextActions,
    stats: {
      roots,
      activeObjectives,
      projectCount,
      horizonCoverage,
      totalWeeklyMinutes,
      totalWeeklyMinutesLabel: formatMinutes(totalWeeklyMinutes),
      busiestDay: busiestDay ? { ...busiestDay, dateLabel: dayFullLabel(busiestDay.date) } : null,
      imbalanceMinutes,
      imbalanceLabel: formatMinutes(imbalanceMinutes),
      highLoadDays: dayLoads.filter((day) => day.totalMinutes >= 300).length,
      linkedTasks: taskOptions.filter((task) => task.objectiveId).length
    },
    weekSummary: {
      totalMinutes: totalWeeklyMinutes,
      totalMinutesLabel: formatMinutes(totalWeeklyMinutes),
      busiestDay: busiestDay ? { ...busiestDay, dateLabel: dayFullLabel(busiestDay.date) } : null,
      lightestDay: lightestDay ? { ...lightestDay, dateLabel: dayFullLabel(lightestDay.date) } : null,
      imbalanceMinutes,
      imbalanceLabel: formatMinutes(imbalanceMinutes),
      dayLoads
    },
    suggestedTemplates: [
      {
        title: "Annual direction",
        horizon: "year",
        kind: "objective",
        summary: "The highest-level direction you want the rest of the tree to serve."
      },
      {
        title: "Quarter focus",
        horizon: "quarter",
        kind: "objective",
        summary: "A quarter-level bet that narrows the year into one strategic focus."
      },
      {
        title: "Weekly project",
        horizon: "week",
        kind: "project",
        summary: "A week-level project connected to concrete blocks and tasks."
      }
    ]
  };
}

export type ObjectivesData = Awaited<ReturnType<typeof getObjectivesData>>;

export function defaultObjectiveDraft() {
  return {
    title: "",
    parentId: "",
    summary: "",
    nextAction: "",
    kind: "objective",
    horizon: "week",
    status: "planned",
    priority: "medium",
    targetDate: toDateKey(),
    weekId: "",
    color: "#8da2fb",
    linkedTaskIds: [] as string[]
  };
}

export function defaultWeeklyBlockDraft(date = toDateKey()) {
  return {
    title: "",
    objectiveId: "",
    category: "work",
    date,
    startTime: "",
    endTime: "",
    durationMinutes: 60,
    flexible: false,
    note: ""
  };
}

export const objectiveKinds = Object.values(ObjectiveKind).map((value) => lower(value));
export const objectiveHorizons = Object.values(ObjectiveHorizon).map((value) => lower(value));
export const objectiveStatuses = Object.values(ObjectiveStatus).map((value) => lower(value));
export const objectivePriorities = Object.values(ObjectivePriority).map((value) => lower(value));
export const weeklyPlanCategories = Object.values(WeeklyPlanCategory).map((value) => lower(value));
