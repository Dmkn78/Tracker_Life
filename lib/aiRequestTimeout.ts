/**
 * How long the browser and the Next proxy wait for an AI answer.
 * Must stay above AI_GENERATION_TIMEOUT_SECONDS on the API (600 s by default) so the
 * API can return its explanatory error instead of the request being cut silently.
 */
export const AI_REQUEST_TIMEOUT_MS = 660_000;
