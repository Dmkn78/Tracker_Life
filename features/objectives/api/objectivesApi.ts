import {
  expectBoolean,
  expectJsonObject,
  expectNullableString,
  expectNumber,
  expectString,
  expectStringArray,
  parseJsonArray,
  requestJson
} from "@/lib/http/apiClient";
import type {
  ObjectiveAllocation,
  ObjectiveCalendarEvent,
  ObjectiveDayLoad,
  ObjectiveNamedDayLoad,
  ObjectiveNextAction,
  ObjectiveRecord,
  ObjectivesData,
  ObjectiveStats,
  ObjectiveSummary,
  ObjectiveTask,
  ObjectiveTemplate,
  ObjectiveTreeNode,
  ObjectiveWeeklyDay,
  ObjectiveWeekSummary,
  WeeklyPlanBlock
} from "../domain/objective";
import {
  objectiveHorizons,
  objectiveKinds,
  objectivePriorities,
  objectiveStatuses,
  type ObjectiveDraft,
  type WeeklyBlockDraft,
  weeklyPlanCategories
} from "../domain/objectiveUi";

type ObjectiveMutationMethod = "POST" | "PATCH";
type ObjectiveMutationInput =
  | ObjectiveDraft
  | (WeeklyBlockDraft & { kind: "weekly_block"; weekId: string });

const TASK_IMPORTANCE_LEVELS = ["low", "medium", "high"] as const;
const TASK_STATUSES = ["planned", "in_progress", "done", "not_done", "postponed", "cancelled"] as const;
const CALENDAR_EVENT_TYPES = [
  "exam",
  "interview",
  "deadline",
  "admin",
  "social",
  "training",
  "recovery",
  "travel",
  "personal"
] as const;
const CALENDAR_IMPACTS = ["low", "medium", "high", "critical"] as const;

export function loadObjectives(
  weekId: string,
  signal?: AbortSignal
): Promise<ObjectivesData> {
  return requestJson(
    `/api/objectives?week_id=${encodeURIComponent(weekId)}`,
    parseObjectivesData,
    { signal }
  );
}

export function saveObjective(
  method: ObjectiveMutationMethod,
  payload: ObjectiveMutationInput
): Promise<ObjectivesData> {
  return requestJson("/api/objectives", parseObjectiveMutationResponse, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function installObjectivesDemo(weekId: string): Promise<ObjectivesData> {
  return requestJson("/api/objectives", parseObjectiveMutationResponse, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "bootstrap_demo", weekId })
  });
}

export function deleteObjective(
  id: string,
  weekId: string,
  kind: "objective" | "weekly_block"
): Promise<ObjectivesData> {
  const query = new URLSearchParams({ id, week_id: weekId });
  if (kind === "weekly_block") query.set("kind", kind);
  return requestJson(
    `/api/objectives?${query.toString()}`,
    parseObjectiveMutationResponse,
    { method: "DELETE" }
  );
}

function parseObjectiveMutationResponse(payload: unknown): ObjectivesData {
  const response = expectJsonObject(payload, "objective mutation response");
  return parseObjectivesData(response.data ?? response);
}

export function parseObjectivesData(payload: unknown): ObjectivesData {
  const data = expectJsonObject(payload, "objectives response");
  return {
    weekId: expectString(data.weekId, "objectives response.weekId"),
    weekDays: expectStringArray(data.weekDays, "objectives response.weekDays"),
    tree: parseJsonArray(data.tree, "objectives response.tree", parseObjectiveTreeNode),
    objectives: parseJsonArray(
      data.objectives,
      "objectives response.objectives",
      parseObjectiveSummary
    ),
    taskOptions: parseJsonArray(
      data.taskOptions,
      "objectives response.taskOptions",
      parseObjectiveTask
    ),
    weeklyBlocks: parseJsonArray(
      data.weeklyBlocks,
      "objectives response.weeklyBlocks",
      parseWeeklyPlanBlock
    ),
    weeklyDays: parseJsonArray(
      data.weeklyDays,
      "objectives response.weeklyDays",
      parseObjectiveWeeklyDay
    ),
    allocation: parseJsonArray(
      data.allocation,
      "objectives response.allocation",
      parseObjectiveAllocation
    ),
    nextActions: parseJsonArray(
      data.nextActions,
      "objectives response.nextActions",
      parseObjectiveNextAction
    ),
    stats: parseObjectiveStats(data.stats, "objectives response.stats"),
    weekSummary: parseObjectiveWeekSummary(
      data.weekSummary,
      "objectives response.weekSummary"
    ),
    suggestedTemplates: parseJsonArray(
      data.suggestedTemplates,
      "objectives response.suggestedTemplates",
      parseObjectiveTemplate
    )
  };
}

function parseObjectiveRecord(payload: unknown, context: string): ObjectiveRecord {
  const objective = expectJsonObject(payload, context);
  return {
    id: expectString(objective.id, `${context}.id`),
    parentId: expectNullableString(objective.parentId, `${context}.parentId`),
    title: expectString(objective.title, `${context}.title`),
    summary: expectNullableString(objective.summary, `${context}.summary`),
    nextAction: expectNullableString(objective.nextAction, `${context}.nextAction`),
    kind: expectLiteral(objective.kind, objectiveKinds, `${context}.kind`),
    horizon: expectLiteral(objective.horizon, objectiveHorizons, `${context}.horizon`),
    status: expectLiteral(objective.status, objectiveStatuses, `${context}.status`),
    priority: expectLiteral(objective.priority, objectivePriorities, `${context}.priority`),
    targetDate: expectNullableString(objective.targetDate, `${context}.targetDate`),
    weekId: expectNullableString(objective.weekId, `${context}.weekId`),
    color: expectString(objective.color, `${context}.color`),
    sortOrder: expectNumber(objective.sortOrder, `${context}.sortOrder`),
    archived: expectBoolean(objective.archived, `${context}.archived`),
    createdAt: expectString(objective.createdAt, `${context}.createdAt`),
    updatedAt: expectString(objective.updatedAt, `${context}.updatedAt`)
  };
}

function parseObjectiveTreeNode(payload: unknown, context: string): ObjectiveTreeNode {
  const node = expectJsonObject(payload, context);
  return {
    ...parseObjectiveRecord(node, context),
    completionPercent: expectNumber(node.completionPercent, `${context}.completionPercent`),
    linkedTasksCount: expectNumber(node.linkedTasksCount, `${context}.linkedTasksCount`),
    linkedTasks: parseJsonArray(node.linkedTasks, `${context}.linkedTasks`, parseObjectiveTask),
    weeklyMinutes: expectNumber(node.weeklyMinutes, `${context}.weeklyMinutes`),
    weeklyBlocksCount: expectNumber(node.weeklyBlocksCount, `${context}.weeklyBlocksCount`),
    children: parseJsonArray(node.children, `${context}.children`, parseObjectiveTreeNode)
  };
}

function parseObjectiveSummary(payload: unknown, context: string): ObjectiveSummary {
  const objective = expectJsonObject(payload, context);
  return {
    ...parseObjectiveRecord(objective, context),
    linkedTaskIds: expectStringArray(objective.linkedTaskIds, `${context}.linkedTaskIds`),
    linkedTasksCount: expectNumber(objective.linkedTasksCount, `${context}.linkedTasksCount`),
    weeklyMinutes: expectNumber(objective.weeklyMinutes, `${context}.weeklyMinutes`)
  };
}

function parseObjectiveTask(payload: unknown, context: string): ObjectiveTask {
  const task = expectJsonObject(payload, context);
  return {
    id: expectString(task.id, `${context}.id`),
    title: expectString(task.title, `${context}.title`),
    date: expectString(task.date, `${context}.date`),
    status: expectLiteral(task.status, TASK_STATUSES, `${context}.status`),
    importance: expectLiteral(task.importance, TASK_IMPORTANCE_LEVELS, `${context}.importance`),
    completionPercent: expectNumber(task.completionPercent, `${context}.completionPercent`),
    estimatedMinutes: expectNumber(task.estimatedMinutes, `${context}.estimatedMinutes`),
    objectiveId: expectNullableString(task.objectiveId, `${context}.objectiveId`),
    objectiveTitle: expectNullableString(task.objectiveTitle, `${context}.objectiveTitle`)
  };
}

function parseWeeklyPlanBlock(payload: unknown, context: string): WeeklyPlanBlock {
  const block = expectJsonObject(payload, context);
  return {
    id: expectString(block.id, `${context}.id`),
    title: expectString(block.title, `${context}.title`),
    date: expectString(block.date, `${context}.date`),
    category: expectLiteral(block.category, weeklyPlanCategories, `${context}.category`),
    startTime: expectNullableString(block.startTime, `${context}.startTime`),
    endTime: expectNullableString(block.endTime, `${context}.endTime`),
    durationMinutes: expectNumber(block.durationMinutes, `${context}.durationMinutes`),
    flexible: expectBoolean(block.flexible, `${context}.flexible`),
    note: expectNullableString(block.note, `${context}.note`),
    objectiveId: expectNullableString(block.objectiveId, `${context}.objectiveId`),
    objectiveTitle: expectNullableString(block.objectiveTitle, `${context}.objectiveTitle`),
    objectiveColor: expectNullableString(block.objectiveColor, `${context}.objectiveColor`),
    createdAt: expectString(block.createdAt, `${context}.createdAt`),
    updatedAt: expectString(block.updatedAt, `${context}.updatedAt`)
  };
}

function parseObjectiveCalendarEvent(
  payload: unknown,
  context: string
): ObjectiveCalendarEvent {
  const event = expectJsonObject(payload, context);
  return {
    id: expectString(event.id, `${context}.id`),
    title: expectString(event.title, `${context}.title`),
    impact: expectLiteral(event.impact, CALENDAR_IMPACTS, `${context}.impact`),
    type: expectLiteral(event.type, CALENDAR_EVENT_TYPES, `${context}.type`),
    start: expectString(event.start, `${context}.start`),
    end: expectString(event.end, `${context}.end`),
    timeLabel: expectString(event.timeLabel, `${context}.timeLabel`)
  };
}

function parseObjectiveWeeklyDay(payload: unknown, context: string): ObjectiveWeeklyDay {
  const day = expectJsonObject(payload, context);
  return {
    date: expectString(day.date, `${context}.date`),
    label: expectString(day.label, `${context}.label`),
    fullLabel: expectString(day.fullLabel, `${context}.fullLabel`),
    isWeekend: expectBoolean(day.isWeekend, `${context}.isWeekend`),
    totalMinutes: expectNumber(day.totalMinutes, `${context}.totalMinutes`),
    loadLabel: expectString(day.loadLabel, `${context}.loadLabel`),
    blocks: parseJsonArray(day.blocks, `${context}.blocks`, parseWeeklyPlanBlock),
    events: parseJsonArray(day.events, `${context}.events`, parseObjectiveCalendarEvent)
  };
}

function parseObjectiveAllocation(payload: unknown, context: string): ObjectiveAllocation {
  const allocation = expectJsonObject(payload, context);
  return {
    key: expectString(allocation.key, `${context}.key`),
    objectiveId: expectNullableString(allocation.objectiveId, `${context}.objectiveId`),
    title: expectString(allocation.title, `${context}.title`),
    color: expectString(allocation.color, `${context}.color`),
    minutes: expectNumber(allocation.minutes, `${context}.minutes`),
    minutesLabel: expectString(allocation.minutesLabel, `${context}.minutesLabel`),
    daysWorked: expectStringArray(allocation.daysWorked, `${context}.daysWorked`),
    dayCount: expectNumber(allocation.dayCount, `${context}.dayCount`),
    blocks: expectNumber(allocation.blocks, `${context}.blocks`)
  };
}

function parseObjectiveNextAction(payload: unknown, context: string): ObjectiveNextAction {
  const action = expectJsonObject(payload, context);
  return {
    id: expectString(action.id, `${context}.id`),
    title: expectString(action.title, `${context}.title`),
    nextAction: expectString(action.nextAction, `${context}.nextAction`),
    horizon: expectLiteral(action.horizon, objectiveHorizons, `${context}.horizon`),
    priority: expectLiteral(action.priority, objectivePriorities, `${context}.priority`),
    status: expectLiteral(action.status, objectiveStatuses, `${context}.status`),
    linkedTasksCount: expectNumber(action.linkedTasksCount, `${context}.linkedTasksCount`),
    weeklyMinutes: expectNumber(action.weeklyMinutes, `${context}.weeklyMinutes`)
  };
}

function parseObjectiveDayLoad(payload: unknown, context: string): ObjectiveDayLoad {
  const day = expectJsonObject(payload, context);
  return {
    date: expectString(day.date, `${context}.date`),
    label: expectString(day.label, `${context}.label`),
    totalMinutes: expectNumber(day.totalMinutes, `${context}.totalMinutes`),
    loadLabel: expectString(day.loadLabel, `${context}.loadLabel`),
    blockCount: expectNumber(day.blockCount, `${context}.blockCount`),
    eventCount: expectNumber(day.eventCount, `${context}.eventCount`),
    isWeekend: expectBoolean(day.isWeekend, `${context}.isWeekend`)
  };
}

function parseObjectiveNamedDayLoad(
  payload: unknown,
  context: string
): ObjectiveNamedDayLoad {
  const day = expectJsonObject(payload, context);
  return {
    ...parseObjectiveDayLoad(day, context),
    dateLabel: expectString(day.dateLabel, `${context}.dateLabel`)
  };
}

function parseNullableNamedDayLoad(
  payload: unknown,
  context: string
): ObjectiveNamedDayLoad | null {
  return payload === null ? null : parseObjectiveNamedDayLoad(payload, context);
}

function parseObjectiveStats(payload: unknown, context: string): ObjectiveStats {
  const stats = expectJsonObject(payload, context);
  return {
    roots: expectNumber(stats.roots, `${context}.roots`),
    activeObjectives: expectNumber(stats.activeObjectives, `${context}.activeObjectives`),
    projectCount: expectNumber(stats.projectCount, `${context}.projectCount`),
    horizonCoverage: expectNumber(stats.horizonCoverage, `${context}.horizonCoverage`),
    totalWeeklyMinutes: expectNumber(stats.totalWeeklyMinutes, `${context}.totalWeeklyMinutes`),
    totalWeeklyMinutesLabel: expectString(
      stats.totalWeeklyMinutesLabel,
      `${context}.totalWeeklyMinutesLabel`
    ),
    busiestDay: parseNullableNamedDayLoad(stats.busiestDay, `${context}.busiestDay`),
    imbalanceMinutes: expectNumber(stats.imbalanceMinutes, `${context}.imbalanceMinutes`),
    imbalanceLabel: expectString(stats.imbalanceLabel, `${context}.imbalanceLabel`),
    highLoadDays: expectNumber(stats.highLoadDays, `${context}.highLoadDays`),
    linkedTasks: expectNumber(stats.linkedTasks, `${context}.linkedTasks`)
  };
}

function parseObjectiveWeekSummary(
  payload: unknown,
  context: string
): ObjectiveWeekSummary {
  const summary = expectJsonObject(payload, context);
  return {
    totalMinutes: expectNumber(summary.totalMinutes, `${context}.totalMinutes`),
    totalMinutesLabel: expectString(summary.totalMinutesLabel, `${context}.totalMinutesLabel`),
    busiestDay: parseNullableNamedDayLoad(summary.busiestDay, `${context}.busiestDay`),
    lightestDay: parseNullableNamedDayLoad(summary.lightestDay, `${context}.lightestDay`),
    imbalanceMinutes: expectNumber(summary.imbalanceMinutes, `${context}.imbalanceMinutes`),
    imbalanceLabel: expectString(summary.imbalanceLabel, `${context}.imbalanceLabel`),
    dayLoads: parseJsonArray(summary.dayLoads, `${context}.dayLoads`, parseObjectiveDayLoad)
  };
}

function parseObjectiveTemplate(payload: unknown, context: string): ObjectiveTemplate {
  const template = expectJsonObject(payload, context);
  return {
    title: expectString(template.title, `${context}.title`),
    horizon: expectLiteral(template.horizon, objectiveHorizons, `${context}.horizon`),
    kind: expectLiteral(template.kind, objectiveKinds, `${context}.kind`),
    summary: expectString(template.summary, `${context}.summary`)
  };
}

function expectLiteral<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  field: string
): T {
  if (typeof value === "string" && allowedValues.includes(value as T)) {
    return value as T;
  }
  throw new Error(`${field} has an unsupported value`);
}
