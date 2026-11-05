const DEFAULT_READ_TIMEOUT_MS = 15_000;
const UPLOAD_READ_TIMEOUT_MS = 610_000;
const AI_PATHS = ["/api/assistant/preview", "/api/insights/ask", "/api/insights/decompose"];

export type NativeReadTimeout = (path: string, isFormDataUpload: boolean) => number;

/**
 * Longest wait per API path for native HTTP. AI calls receive `aiRequestTimeoutMs`, which must
 * outlast the API's own generation limit so its explanatory error reaches the phone.
 */
export function buildNativeReadTimeout(aiRequestTimeoutMs: number): NativeReadTimeout {
  const timeoutsByPrefix: readonly [string, number][] = [
    ["/api/transcription-jobs", UPLOAD_READ_TIMEOUT_MS],
    ["/api/transcribe", 190_000],
    ...AI_PATHS.map((path): [string, number] => [path, aiRequestTimeoutMs]),
    ["/api/ai-providers/test", 30_000],
    ["/api/knowledge/sync", 60_000],
    ["/api/mobile-update", 45_000]
  ];
  const readTimeoutForPath: NativeReadTimeout = (path, isFormDataUpload) => {
    if (isFormDataUpload) return UPLOAD_READ_TIMEOUT_MS;
    const pathname = path.split("?", 1)[0];
    const matchedTimeout = timeoutsByPrefix.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    const readTimeoutMs = matchedTimeout ? matchedTimeout[1] : DEFAULT_READ_TIMEOUT_MS;
    return readTimeoutMs;
  };
  return readTimeoutForPath;
}
