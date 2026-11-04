export type CaptureKind = "task" | "note";

/** When a task should happen; notes have no date. */
export type CaptureWhen = "today" | "tomorrow" | "later";

export type CaptureRequest = { kind: CaptureKind; text: string; date: string | null };

/** "saved" = on the server; "queued" = kept on the phone until the connection comes back. */
export type CaptureOutcome = "saved" | "queued";

export type CaptureSubmitter = (capture: CaptureRequest) => Promise<CaptureOutcome>;

export type CaptureKeyPress = { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; isComposing: boolean };

/** Fired after any capture so open screens (week board, notes) refresh themselves. */
export const CAPTURE_SAVED_EVENT = "life-regime:capture-saved";
/** Fired to open the capture sheet from anywhere (header button, deep link, notification). */
export const OPEN_CAPTURE_EVENT = "life-regime:open-capture";
export const CAPTURE_QUERY_PARAMETER = "capture";
export const MAX_TASK_TITLE_LENGTH = 500;
export const MAX_NOTE_LENGTH = 50_000;
export const CAPTURE_KINDS: readonly CaptureKind[] = ["task", "note"];
export const CAPTURE_WHEN_OPTIONS: readonly CaptureWhen[] = ["today", "tomorrow", "later"];

export function resolveCaptureDate(when: CaptureWhen, todayKey: string): string | null {
  if (when === "later") return null;
  if (when === "today") return todayKey;
  const tomorrow = new Date(`${todayKey}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  return tomorrowKey;
}

export function buildCaptureRequest(kind: CaptureKind, text: string, when: CaptureWhen, todayKey: string): CaptureRequest {
  const request: CaptureRequest = {
    kind,
    text: text.trim(),
    date: kind === "task" ? resolveCaptureDate(when, todayKey) : null
  };
  return request;
}

export function isCaptureTextValid(kind: CaptureKind, text: string): boolean {
  const trimmedLength = text.trim().length;
  const maximumLength = kind === "task" ? MAX_TASK_TITLE_LENGTH : MAX_NOTE_LENGTH;
  const isValid = trimmedLength > 0 && trimmedLength <= maximumLength;
  return isValid;
}

/** A task is one line (Enter saves); a note is free text (Ctrl/⌘ + Enter saves, Enter goes to the next line). */
export function shouldSaveOnKeyPress(kind: CaptureKind, keyPress: CaptureKeyPress): boolean {
  if (keyPress.key !== "Enter" || keyPress.isComposing) return false;
  const shouldSave = kind === "task" ? !keyPress.shiftKey : keyPress.ctrlKey || keyPress.metaKey;
  return shouldSave;
}

/** `?capture=task` or `?capture=note` opens the sheet directly (home-screen shortcuts, widget). */
export function readRequestedCaptureKind(search: string): CaptureKind | null {
  const requestedKind = new URLSearchParams(search).get(CAPTURE_QUERY_PARAMETER);
  const captureKind = CAPTURE_KINDS.find((kind) => kind === requestedKind) ?? null;
  return captureKind;
}
