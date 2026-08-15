export type ObjectiveKind = "objective" | "project" | "milestone";
export type ObjectiveHorizon = "year" | "quarter" | "month" | "week";
export type ObjectiveStatus = "planned" | "active" | "on_track" | "at_risk" | "paused" | "done";
export type ObjectivePriority = "low" | "medium" | "high" | "critical";
export type WeeklyPlanCategory = "work" | "study" | "sport" | "rest" | "admin" | "personal" | "social" | "travel";
export type ObjectiveTaskImportance = "low" | "medium" | "high";
export type ObjectiveTaskStatus = "planned" | "in_progress" | "done" | "not_done" | "postponed" | "cancelled";
export type ObjectiveCalendarEventType = "exam" | "interview" | "deadline" | "admin" | "social" | "training" | "recovery" | "travel" | "personal";
export type ObjectiveCalendarImpact = "low" | "medium" | "high" | "critical";

export type ObjectiveRecord = {
  id: string;
  parentId: string | null;
  title: string;
  summary: string | null;
  nextAction: string | null;
  kind: ObjectiveKind;
  horizon: ObjectiveHorizon;
  status: ObjectiveStatus;
  priority: ObjectivePriority;
  targetDate: string | null;
  weekId: string | null;
  color: string;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ObjectiveTask = {
  id: string;
  title: string;
  date: string;
  status: ObjectiveTaskStatus;
  importance: ObjectiveTaskImportance;
  completionPercent: number;
  estimatedMinutes: number;
  objectiveId: string | null;
  objectiveTitle: string | null;
};

export type ObjectiveTreeNode = ObjectiveRecord & {
  completionPercent: number;
  linkedTasksCount: number;
  linkedTasks: ObjectiveTask[];
  weeklyMinutes: number;
  weeklyBlocksCount: number;
  children: ObjectiveTreeNode[];
};

export type ObjectiveSummary = ObjectiveRecord & {
  linkedTaskIds: string[];
  linkedTasksCount: number;
  weeklyMinutes: number;
};

export type WeeklyPlanBlock = {
  id: string;
  title: string;
  date: string;
  category: WeeklyPlanCategory;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  flexible: boolean;
  note: string | null;
  objectiveId: string | null;
  objectiveTitle: string | null;
  objectiveColor: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ObjectiveCalendarEvent = {
  id: string;
  title: string;
  impact: ObjectiveCalendarImpact;
  type: ObjectiveCalendarEventType;
  start: string;
  end: string;
  timeLabel: string;
};

export type ObjectiveWeeklyDay = {
  date: string;
  label: string;
  fullLabel: string;
  isWeekend: boolean;
  totalMinutes: number;
  loadLabel: string;
  blocks: WeeklyPlanBlock[];
  events: ObjectiveCalendarEvent[];
};

export type ObjectiveAllocation = {
  key: string;
  objectiveId: string | null;
  title: string;
  color: string;
  minutes: number;
  minutesLabel: string;
  daysWorked: string[];
  dayCount: number;
  blocks: number;
};

export type ObjectiveNextAction = {
  id: string;
  title: string;
  nextAction: string;
  horizon: ObjectiveHorizon;
  priority: ObjectivePriority;
  status: ObjectiveStatus;
  linkedTasksCount: number;
  weeklyMinutes: number;
};

export type ObjectiveDayLoad = {
  date: string;
  label: string;
  totalMinutes: number;
  loadLabel: string;
  blockCount: number;
  eventCount: number;
  isWeekend: boolean;
};

export type ObjectiveNamedDayLoad = ObjectiveDayLoad & { dateLabel: string };

export type ObjectiveStats = {
  roots: number;
  activeObjectives: number;
  projectCount: number;
  horizonCoverage: number;
  totalWeeklyMinutes: number;
  totalWeeklyMinutesLabel: string;
  busiestDay: ObjectiveNamedDayLoad | null;
  imbalanceMinutes: number;
  imbalanceLabel: string;
  highLoadDays: number;
  linkedTasks: number;
};

export type ObjectiveWeekSummary = {
  totalMinutes: number;
  totalMinutesLabel: string;
  busiestDay: ObjectiveNamedDayLoad | null;
  lightestDay: ObjectiveNamedDayLoad | null;
  imbalanceMinutes: number;
  imbalanceLabel: string;
  dayLoads: ObjectiveDayLoad[];
};

export type ObjectiveTemplate = {
  title: string;
  horizon: ObjectiveHorizon;
  kind: ObjectiveKind;
  summary: string;
};

export type ObjectivesData = {
  weekId: string;
  weekDays: string[];
  tree: ObjectiveTreeNode[];
  objectives: ObjectiveSummary[];
  taskOptions: ObjectiveTask[];
  weeklyBlocks: WeeklyPlanBlock[];
  weeklyDays: ObjectiveWeeklyDay[];
  allocation: ObjectiveAllocation[];
  nextActions: ObjectiveNextAction[];
  stats: ObjectiveStats;
  weekSummary: ObjectiveWeekSummary;
  suggestedTemplates: ObjectiveTemplate[];
};
