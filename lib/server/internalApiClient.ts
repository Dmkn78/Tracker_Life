import "server-only";

import { cookies } from "next/headers";
import { ApiError } from "@/lib/http/apiClient";

type JsonParser<T> = (payload: unknown) => T;

const DEFAULT_INTERNAL_API_URL = "http://127.0.0.1:8000";
const INTERNAL_API_TIMEOUT_MS = 30_000;

export async function requestInternalApiJson<T>(
  apiPath: string,
  parser: JsonParser<T>
): Promise<T> {
  const internalApiUrl = process.env.INTERNAL_API_URL || DEFAULT_INTERNAL_API_URL;
  const url = new URL(apiPath, internalApiUrl);
  const cookieHeader = (await cookies())
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      },
      cache: "no-store",
      signal: AbortSignal.timeout(INTERNAL_API_TIMEOUT_MS)
    });
  } catch (cause: unknown) {
    throw new ApiError("API service is unavailable.", 503, cause);
  }

  const payload = await readJsonPayload(response);
  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload, response.status), response.status, payload);
  }

  try {
    return parser(payload);
  } catch (cause: unknown) {
    throw new ApiError("The API returned an invalid response.", response.status, cause);
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (cause: unknown) {
    throw new ApiError("The API returned invalid JSON.", response.status, cause);
  }
}

function readErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const error = payload as Record<string, unknown>;
    if (typeof error.error === "string") return error.error;
    if (typeof error.detail === "string") return error.detail;
  }
  return `API request failed with status ${status}.`;
}
