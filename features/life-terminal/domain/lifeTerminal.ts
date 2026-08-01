import type { CalendarEvent } from "@/features/calendar/domain/calendarEvent";

export const LIFE_REGIMES = [
  "stable",
  "productive",
  "pressure",
  "recovery",
  "drift",
  "burnout_risk",
  "chaotic"
] as const;

export type LifeRegime = (typeof LIFE_REGIMES)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type LifeTerminalTask = {
  id: string;
  title: string;
  date: string;
  importance: string;
  productive: boolean;
  estimatedMinutes: number;
  completionPercent: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type LifeTerminalEvent = CalendarEvent;

export type LifeTerminalTrajectoryPoint = {
  date: string;
  status: string;
  stateScore: number | null;
  riskScore: number | null;
  executionScore: number | null;
  startFriction: number | null;
  productivity: number | null;
  energy: number | null;
  caloriePercent: number | null;
  calendarPressure: number;
  todoCompletion: number;
};

export type LifeTerminalAllocationRow = {
  id: string;
  name: string;
  objective: string;
  targetWeight: number;
  actualWeight: number;
  plannedMinutes: number;
  autoPlannedMinutes: number;
  plannedMinutesManual: boolean;
  actualMinutes: number;
  color: string;
};

type TodoMetrics = {
  tasksPlanned: number;
  weightedCompletionRate: number;
  missedImportantTasks: number;
  productiveTaskCompletion: number;
};

type TransitionMatrixRow = {
  from: LifeRegime;
  active: boolean;
  probabilities: Record<LifeRegime, number>;
};

export type LifeTerminalData = {
  today: string;
  weekId: string;
  terminalHeader: {
    date: string;
    weekId: string;
    regime: LifeRegime;
    phase: string;
    dailyLogStatus: string;
    nextHighImpactEvent: LifeTerminalEvent | null;
    dataQuality: string;
    risk: string;
  };
  lifeTape: {
    items: Array<{
      label: string;
      value: number | null;
      delta: number;
      inverted: boolean;
    }>;
    calendarPressureLabel: string;
  };
  regime: {
    regime: LifeRegime;
    confidence: number;
    why: string[];
    lastRegime: LifeRegime | null;
    changed: boolean;
  };
  quant: {
    projection: Array<{ regime: LifeRegime; probability: number }>;
    transitionMatrix: TransitionMatrixRow[];
  };
  calendarContext: {
    activePhase: string;
    highImpactEventsNext7d: number;
    maxImpact: string | null;
    averageStress: number;
    averagePreparationLoad: number;
    weeklyExpectedStressLoad: number;
    weeklyExpectedPreparationLoad: number;
    nextHighImpactEvent: LifeTerminalEvent | null;
    pressureLevel: number;
  };
  trajectory: LifeTerminalTrajectoryPoint[];
  enoughForTrend: boolean;
  initialEvents: LifeTerminalEvent[];
  taskSections: {
    today: LifeTerminalTask[];
    thisWeek: LifeTerminalTask[];
    overdue: LifeTerminalTask[];
    highImportance: LifeTerminalTask[];
    productive: LifeTerminalTask[];
  };
  taskMetrics: {
    today: TodoMetrics;
    week: TodoMetrics;
    plannedVsDone: {
      planned: number;
      done: number;
    };
  };
  quickLog: {
    date: string;
    status: string;
    energy: number;
    productivity: number;
    startFriction: number;
    calorieTarget: number;
    caloriePercent: number;
    trainingDone: boolean | null;
    mentalFatigue: number;
    physicalFatigue: number;
    focusQuality: number;
    workTimeMinutes: number;
    distractionTimeMinutes: number;
    avoidedImportantTask: boolean | null;
    mainBlocker: string;
    improvementTomorrow: string;
    sleepIntentClickedAt: string | null;
    estimatedSleepDelayMin: number;
    textSummary: string;
    voiceTranscript: string;
  };
  timeAllocation: {
    dayBudgetMinutes: number;
    targetWeightTotal: number;
    actualMinutesTotal: number;
    plannedMinutesTotal: number;
    rows: LifeTerminalAllocationRow[];
  };
  weeklyPlanner: {
    objective: string;
    topPriorities: LifeTerminalTask[];
    tasksByDay: Array<{
      date: string;
      tasks: LifeTerminalTask[];
    }>;
    majorEvents: LifeTerminalEvent[];
    missingPlanningWarning: boolean;
  };
  dataQuality: {
    submittedLogsThisWeek: number;
    missingDays: number;
    missingDayKeys: string[];
    calendarEvents: number;
    tasksTracked: number;
    enoughDataForTrend: boolean;
    enoughDataForRegimeDetection: boolean;
    weeklyExportPreview: JsonValue;
  };
  weeklySummary: {
    weekId: string;
    period: { start: string; end: string };
    avgStateScore: number | null;
    avgRiskScore: number | null;
    avgExecutionScore: number | null;
    avgStartFriction: number | null;
    submittedLogs: number;
    missingDays: number;
    missingDayKeys: string[];
    skippedDays: number;
    skippedDayKeys: string[];
    trainingDays: number;
    activePhase: string;
  };
  interpretation: string[];
};
