import {
  expectJsonObject,
  expectNumber,
  expectString,
  requestJson
} from "@/lib/http/apiClient";
import {
  isDayLogStatus,
  parseDailyLogFields,
  type DailyLogDraft,
  type DayLogStatus
} from "../domain/dailyLog";

export type DailyLogScores = {
  executionScore?: number | null;
  stateScore?: number | null;
  riskScore?: number | null;
  riskDelta?: number | null;
  riskAcceleration?: number | null;
};

export type DailyLogRecord = Partial<DailyLogDraft> &
  DailyLogScores & {
    updatedAt?: string | null;
  };

export type DailyLogResponse = {
  log: DailyLogRecord | null;
  todoMetrics: {
    tasksPlanned: number;
    weightedCompletionRate: number;
    missedImportantTasks: number;
    productiveTaskCompletion: number;
  };
  calendarContext: {
    activePhase: string;
  };
};

export function loadDailyLog(date: string, signal?: AbortSignal): Promise<DailyLogResponse> {
  return requestJson(`/api/daily-log?date=${encodeURIComponent(date)}`, parseDailyLogResponse, { signal });
}

export function saveDailyLog(
  draft: DailyLogDraft,
  status: DayLogStatus
): Promise<DailyLogResponse> {
  return requestJson("/api/daily-log", parseDailyLogResponse, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...draft, status })
  });
}

export function parseDailyLogStatuses(payload: unknown): Record<string, DayLogStatus> {
  const response = expectJsonObject(payload, "daily-log statuses response");
  const statuses = expectJsonObject(response.statuses, "daily-log statuses response.statuses");
  return Object.fromEntries(
    Object.entries(statuses).map(([date, status]) => {
      if (!isDayLogStatus(status)) {
        throw new Error(`daily-log status for ${date} has an unsupported value`);
      }
      return [date, status];
    })
  );
}

function parseDailyLogResponse(payload: unknown): DailyLogResponse {
  const response = expectJsonObject(payload, "daily-log response");
  const log = response.log === null ? null : parseDailyLogRecord(response.log);
  const metrics = expectJsonObject(response.todoMetrics, "todoMetrics");
  const calendar = expectJsonObject(response.calendarContext, "calendarContext");
  return {
    log,
    todoMetrics: {
      tasksPlanned: expectNumber(metrics.tasksPlanned, "todoMetrics.tasksPlanned"),
      weightedCompletionRate: expectNumber(metrics.weightedCompletionRate, "todoMetrics.weightedCompletionRate"),
      missedImportantTasks: expectNumber(metrics.missedImportantTasks, "todoMetrics.missedImportantTasks"),
      productiveTaskCompletion: expectNumber(metrics.productiveTaskCompletion, "todoMetrics.productiveTaskCompletion")
    },
    calendarContext: {
      activePhase: expectString(calendar.activePhase, "calendarContext.activePhase")
    }
  };
}

function parseDailyLogRecord(payload: unknown): DailyLogRecord {
  const record = expectJsonObject(payload, "daily-log record");
  const parsedDraft = parseDailyLogFields(record);
  return {
    ...parsedDraft,
    executionScore: optionalNullableNumber(record.executionScore, "log.executionScore"),
    stateScore: optionalNullableNumber(record.stateScore, "log.stateScore"),
    riskScore: optionalNullableNumber(record.riskScore, "log.riskScore"),
    riskDelta: optionalNullableNumber(record.riskDelta, "log.riskDelta"),
    riskAcceleration: optionalNullableNumber(record.riskAcceleration, "log.riskAcceleration"),
    updatedAt: optionalNullableString(record.updatedAt, "log.updatedAt")
  };
}

function optionalNullableNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined || value === null) return value;
  return expectNumber(value, field);
}

function optionalNullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  return expectString(value, field);
}
