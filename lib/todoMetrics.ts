import type { CalendarImpact, Task, TaskImportance } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, getIsoWeekId, getWeekDateKeys, parseDateKey } from "@/lib/dates";

const IMPORTANCE_WEIGHT: Record<TaskImportance, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

export type TodoMetrics = {
  tasksPlanned: number;
  weightedCompletionRate: number;
  missedImportantTasks: number;
  productiveTaskCompletion: number;
};

export function calculateTodoMetrics(tasks: Task[]): TodoMetrics {
  const activeTasks = tasks.filter((task) => task.status !== "CANCELLED");
  const totalWeight = activeTasks.reduce((sum, task) => sum + IMPORTANCE_WEIGHT[task.importance], 0);
  const completedWeight = activeTasks.reduce(
    (sum, task) => sum + (IMPORTANCE_WEIGHT[task.importance] * task.completionPercent) / 100,
    0
  );
  const productiveTasks = activeTasks.filter((task) => task.productive);
  const productiveTaskCompletion =
    productiveTasks.length === 0
      ? 0
      : productiveTasks.reduce((sum, task) => sum + task.completionPercent, 0) /
        (productiveTasks.length * 100);

  return {
    tasksPlanned: activeTasks.length,
    weightedCompletionRate: totalWeight === 0 ? 0 : completedWeight / totalWeight,
    missedImportantTasks: activeTasks.filter(
      (task) => task.importance === "HIGH" && task.completionPercent < 100 && task.status !== "DONE"
    ).length,
    productiveTaskCompletion
  };
}

export const computeTaskMetrics = calculateTodoMetrics;

export async function getTodoMetrics(userId: string, dateKey: string) {
  const tasks = await prisma.task.findMany({
    where: { userId, date: parseDateKey(dateKey) },
    orderBy: [{ importance: "desc" }, { createdAt: "asc" }]
  });
  return { tasks, metrics: calculateTodoMetrics(tasks) };
}

export type CalendarContext = {
  activePhase: "exam_week" | "interview_week" | "deadline_week" | "high_pressure_week" | "normal_week";
  highImpactEventsNext7d: number;
  maxImpact: CalendarImpact | null;
  averageStress: number;
  averagePreparationLoad: number;
  weeklyExpectedStressLoad: number;
  weeklyExpectedPreparationLoad: number;
};

export function detectActivePhaseForWeek(events: Array<{ type: string; impact: CalendarImpact }>): CalendarContext["activePhase"] {
  const highImpactCount = events.filter((event) => event.impact === "HIGH" || event.impact === "CRITICAL").length;
  if (events.some((event) => event.type === "EXAM")) return "exam_week";
  if (events.some((event) => event.type === "INTERVIEW")) return "interview_week";
  if (events.some((event) => event.type === "DEADLINE")) return "deadline_week";
  if (highImpactCount > 1) return "high_pressure_week";
  return "normal_week";
}

export function countHighImpactEventsNext7Days(events: Array<{ impact: CalendarImpact }>) {
  return events.filter((event) => event.impact === "HIGH" || event.impact === "CRITICAL").length;
}

export function getWeeklyExpectedStressLoad(events: Array<{ expectedStress: number; expectedPreparationLoad: number }>) {
  if (events.length === 0) return { stress: 0, preparation: 0 };
  return {
    stress: Math.round(events.reduce((sum, event) => sum + event.expectedStress, 0) / events.length),
    preparation: Math.round(events.reduce((sum, event) => sum + event.expectedPreparationLoad, 0) / events.length)
  };
}

export async function getNextHighImpactEvent(userId: string, dateKey: string) {
  return prisma.calendarEvent.findFirst({
    where: {
      userId,
      start: { gte: parseDateKey(dateKey) },
      impact: { in: ["HIGH", "CRITICAL"] }
    },
    orderBy: { start: "asc" }
  });
}

export async function getCalendarContext(userId: string, dateKey: string): Promise<CalendarContext> {
  const weekDays = getWeekDateKeys(getIsoWeekId(dateKey));
  const [weekEvents, nextEvents] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId,
        start: {
          gte: parseDateKey(weekDays[0]),
          lt: parseDateKey(addDays(weekDays[6], 1))
        }
      }
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        start: {
          gte: parseDateKey(dateKey),
          lt: parseDateKey(addDays(dateKey, 7))
        }
      }
    })
  ]);
  const activePhase = detectActivePhaseForWeek(weekEvents);
  const highImpactEventsNext7d = countHighImpactEventsNext7Days(nextEvents);
  const weeklyLoad = getWeeklyExpectedStressLoad(weekEvents);
  const averageStress =
    nextEvents.length === 0 ? 0 : nextEvents.reduce((sum, event) => sum + event.expectedStress, 0) / nextEvents.length;
  const averagePreparationLoad =
    nextEvents.length === 0
      ? 0
      : nextEvents.reduce((sum, event) => sum + event.expectedPreparationLoad, 0) / nextEvents.length;
  const impactRank: CalendarImpact[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const maxImpact = nextEvents.reduce<CalendarImpact | null>((max, event) => {
    if (!max) return event.impact;
    return impactRank.indexOf(event.impact) > impactRank.indexOf(max) ? event.impact : max;
  }, null);

  return {
    activePhase,
    highImpactEventsNext7d,
    maxImpact,
    averageStress,
    averagePreparationLoad,
    weeklyExpectedStressLoad: weeklyLoad.stress,
    weeklyExpectedPreparationLoad: weeklyLoad.preparation
  };
}

export const computeCalendarContext = getCalendarContext;
