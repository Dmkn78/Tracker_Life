export type JsonObject = Record<string, unknown>;

type JsonParser<T> = (payload: unknown) => T;

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

type ApiTransport = (url: string, options: RequestInit) => Promise<Response>;
let apiTransport: ApiTransport = (url, options) => fetch(url, options);

/** The Android entry point supplies its native HTTP transport; web keeps same-origin fetch. */
export function configureApiTransport(transport: ApiTransport): void {
  apiTransport = transport;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson<T>(
  url: string,
  parser: JsonParser<T>,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal, ...requestOptions } = options;
  const requestController = new AbortController();
  const abortRequest = () => requestController.abort(signal?.reason);
  if (signal?.aborted) requestController.abort(signal.reason);
  else signal?.addEventListener("abort", abortRequest, { once: true });
  const timeout = setTimeout(() => requestController.abort("Request timed out"), timeoutMs);

  try {
    const response = await apiTransport(url, {
      ...requestOptions,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...requestOptions.headers
      },
      signal: requestController.signal
    });
    const payload = await readJsonPayload(response);
    if (!response.ok) {
      throw new ApiError(readErrorMessage(payload, response.status), response.status, payload);
    }

    try {
      return parser(payload);
    } catch (cause: unknown) {
      throw new ApiError("The API returned an invalid response.", response.status, cause);
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortRequest);
  }
}

export function expectJsonObject(payload: unknown, context = "response"): JsonObject {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${context} must be an object`);
  }
  return payload as JsonObject;
}

export function expectString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
}

export function expectNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}

export function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
  return value;
}

export function expectNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return expectString(value, field);
}

export function expectOptionalNullableString(
  value: unknown,
  field: string
): string | null | undefined {
  if (value === undefined) return undefined;
  return expectNullableString(value, field);
}

export function expectStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value;
}

export function parseJsonArray<T>(
  value: unknown,
  field: string,
  parser: (entry: unknown, context: string) => T
): T[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.map((entry, index) => parser(entry, `${field}[${index}]`));
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const responseText = await response.text();
  if (!responseText) return null;
  try {
    return JSON.parse(responseText) as unknown;
  } catch (cause: unknown) {
    throw new ApiError("The API returned invalid JSON.", response.status, cause);
  }
}

function readErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const errorPayload = payload as JsonObject;
    if (typeof errorPayload.error === "string") return errorPayload.error;
    if (typeof errorPayload.detail === "string") return errorPayload.detail;
  }
  return `API request failed with status ${status}.`;
}
