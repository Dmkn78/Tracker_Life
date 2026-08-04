export const DAILY_LOG_STATUS_VALUES = [
  "empty",
  "draft",
  "submitted",
  "analyzed",
  "missing",
  "skipped"
] as const;

export type DayLogStatus = (typeof DAILY_LOG_STATUS_VALUES)[number];

export type DailyLogDraft = {
  date: string;
  status: DayLogStatus;
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
  mainBlockerOtherText: string;
  improvementTomorrow: string;
  wins: string[];
  topImprovements: string[];
  blockers: string[];
  tomorrowPriorities: string[];
  tags: string[];
  customFields: Record<string, string>;
  textSummary: string;
  voiceTranscript: string;
  transcriptionStatus: "idle" | "uploading" | "transcribing" | "done" | "error";
  sleepIntentClickedAt: string | null;
  estimatedSleepDelayMin: number;
};

export type StoredDailyLogDraft = {
  savedAt: string;
  log: Partial<DailyLogDraft>;
};

const DAILY_LOG_STATUSES = new Set<string>(DAILY_LOG_STATUS_VALUES);
const TRANSCRIPTION_STATUSES = new Set<DailyLogDraft["transcriptionStatus"]>([
  "idle",
  "uploading",
  "transcribing",
  "done",
  "error"
]);
const NUMBER_FIELDS = [
  "energy",
  "productivity",
  "startFriction",
  "calorieTarget",
  "caloriePercent",
  "mentalFatigue",
  "physicalFatigue",
  "focusQuality",
  "workTimeMinutes",
  "distractionTimeMinutes",
  "estimatedSleepDelayMin"
] as const satisfies ReadonlyArray<keyof DailyLogDraft>;
const STRING_FIELDS = [
  "date",
  "mainBlocker",
  "mainBlockerOtherText",
  "improvementTomorrow",
  "textSummary",
  "voiceTranscript"
] as const satisfies ReadonlyArray<keyof DailyLogDraft>;
const STRING_ARRAY_FIELDS = [
  "wins",
  "topImprovements",
  "blockers",
  "tomorrowPriorities",
  "tags"
] as const satisfies ReadonlyArray<keyof DailyLogDraft>;
const MAX_TOP_IMPROVEMENTS = 3;

export function createDailyLogDraft(
  date: string,
  defaultSleepDelayMin = 20,
  calorieTarget = 2200
): DailyLogDraft {
  return {
    date,
    status: "draft",
    energy: 50,
    productivity: 50,
    startFriction: 50,
    calorieTarget,
    caloriePercent: 100,
    trainingDone: null,
    mentalFatigue: 50,
    physicalFatigue: 50,
    focusQuality: 50,
    workTimeMinutes: 0,
    distractionTimeMinutes: 0,
    avoidedImportantTask: null,
    mainBlocker: "none",
    mainBlockerOtherText: "",
    improvementTomorrow: "",
    wins: [],
    topImprovements: [],
    blockers: [],
    tomorrowPriorities: [],
    tags: [],
    customFields: {},
    textSummary: "",
    voiceTranscript: "",
    transcriptionStatus: "idle",
    sleepIntentClickedAt: null,
    estimatedSleepDelayMin: defaultSleepDelayMin
  };
}

export function sanitizeDailyLogDraft(value: DailyLogDraft): DailyLogDraft {
  const blocker = normalizeMainBlocker(value.mainBlocker);
  return {
    ...value,
    energy: numberOrFallback(value.energy, 50),
    productivity: numberOrFallback(value.productivity, 50),
    startFriction: numberOrFallback(value.startFriction, 50),
    calorieTarget: numberOrFallback(value.calorieTarget, 2200),
    caloriePercent: numberOrFallback(value.caloriePercent, 100),
    mentalFatigue: numberOrFallback(value.mentalFatigue, 50),
    physicalFatigue: numberOrFallback(value.physicalFatigue, 50),
    focusQuality: numberOrFallback(value.focusQuality, 50),
    workTimeMinutes: numberOrFallback(value.workTimeMinutes, 0),
    distractionTimeMinutes: numberOrFallback(value.distractionTimeMinutes, 0),
    mainBlocker: blocker.selected,
    mainBlockerOtherText: value.mainBlockerOtherText ?? blocker.otherText,
    improvementTomorrow: value.improvementTomorrow ?? "",
    wins: value.wins ?? [],
    topImprovements: (value.topImprovements ?? []).slice(0, MAX_TOP_IMPROVEMENTS),
    blockers: value.blockers ?? [],
    tomorrowPriorities: value.tomorrowPriorities ?? [],
    tags: value.tags ?? [],
    customFields: value.customFields ?? {},
    textSummary: value.textSummary ?? "",
    voiceTranscript: value.voiceTranscript ?? "",
    transcriptionStatus: value.transcriptionStatus ?? "idle"
  };
}

export function resolveMainBlocker(selected: string, otherText: string): string {
  if (selected !== "other") return selected;
  const cleanedOtherText = otherText.trim();
  return cleanedOtherText ? `other:${cleanedOtherText}` : "other";
}

export function parseStoredDailyLogDraft(rawValue: string | null): StoredDailyLogDraft | null {
  if (!rawValue) return null;
  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) return null;
    const record = parsedValue as Record<string, unknown>;
    if (typeof record.savedAt === "string" && record.log && typeof record.log === "object") {
      return { savedAt: record.savedAt, log: parseDailyLogFields(record.log) };
    }
    return { savedAt: "", log: parseDailyLogFields(record) };
  } catch {
    return null;
  }
}

export function parseDailyLogFields(value: unknown): Partial<DailyLogDraft> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("daily log must be an object");
  }
  const source = value as Record<string, unknown>;
  const parsed: Partial<DailyLogDraft> = {};

  for (const field of NUMBER_FIELDS) {
    const fieldValue = source[field];
    if (fieldValue === undefined || fieldValue === null) continue;
    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
      throw new Error(`${field} must be a finite number`);
    }
    Object.assign(parsed, { [field]: fieldValue });
  }
  for (const field of STRING_FIELDS) {
    const fieldValue = source[field];
    if (fieldValue === undefined || fieldValue === null) continue;
    if (typeof fieldValue !== "string") throw new Error(`${field} must be a string`);
    Object.assign(parsed, { [field]: fieldValue });
  }
  for (const field of STRING_ARRAY_FIELDS) {
    const fieldValue = source[field];
    if (fieldValue === undefined || fieldValue === null) continue;
    if (!Array.isArray(fieldValue) || fieldValue.some((entry) => typeof entry !== "string")) {
      throw new Error(`${field} must be an array of strings`);
    }
    Object.assign(parsed, { [field]: fieldValue as string[] });
  }
  if (source.customFields !== undefined && source.customFields !== null) {
    if (typeof source.customFields !== "object" || Array.isArray(source.customFields)) {
      throw new Error("customFields must be an object");
    }
    const entries = Object.entries(source.customFields as Record<string, unknown>);
    if (entries.some(([, value]) => typeof value !== "string")) {
      throw new Error("customFields values must be strings");
    }
    parsed.customFields = Object.fromEntries(entries) as Record<string, string>;
  }
  for (const field of ["trainingDone", "avoidedImportantTask"] as const) {
    const fieldValue = source[field];
    if (fieldValue === undefined) continue;
    if (fieldValue !== null && typeof fieldValue !== "boolean") {
      throw new Error(`${field} must be a boolean or null`);
    }
    Object.assign(parsed, { [field]: fieldValue });
  }
  if (source.status !== undefined) {
    if (!isDayLogStatus(source.status)) {
      throw new Error("status is invalid");
    }
    parsed.status = source.status;
  }
  if (source.transcriptionStatus !== undefined) {
    if (
      typeof source.transcriptionStatus !== "string"
      || !TRANSCRIPTION_STATUSES.has(source.transcriptionStatus as DailyLogDraft["transcriptionStatus"])
    ) {
      throw new Error("transcriptionStatus is invalid");
    }
    parsed.transcriptionStatus = source.transcriptionStatus as DailyLogDraft["transcriptionStatus"];
  }
  if (source.sleepIntentClickedAt !== undefined) {
    if (source.sleepIntentClickedAt !== null && typeof source.sleepIntentClickedAt !== "string") {
      throw new Error("sleepIntentClickedAt must be a string or null");
    }
    parsed.sleepIntentClickedAt = source.sleepIntentClickedAt;
  }
  return parsed;
}

export function isDayLogStatus(value: unknown): value is DayLogStatus {
  return typeof value === "string" && DAILY_LOG_STATUSES.has(value);
}

function numberOrFallback(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeMainBlocker(value: string | null | undefined): {
  selected: string;
  otherText: string;
} {
  const fallback = { selected: "none", otherText: "" };
  if (!value) return fallback;
  const knownBlockers = ["none", "fatigue", "phone", "stress", "unclear task", "lack of time", "social", "transport", "other"];
  if (knownBlockers.includes(value)) return { selected: value, otherText: "" };
  if (value.startsWith("other:")) return { selected: "other", otherText: value.slice(6).trim() };
  return { selected: "other", otherText: value };
}
