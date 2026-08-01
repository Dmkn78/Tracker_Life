import "server-only";

const DEFAULT_INTERNAL_API_URL = "http://127.0.0.1:8000";
const API_PROXY_TIMEOUT_MS = 30_000;
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

type ProxyApiRequestOptions = {
  timeoutMs?: number;
};

export async function proxyApiRequest(
  request: Request,
  apiPath: string,
  options: ProxyApiRequestOptions = {}
): Promise<Response> {
  const { timeoutMs = API_PROXY_TIMEOUT_MS } = options;
  const upstreamUrl = buildUpstreamUrl(request.url, apiPath);
  const requestHeaders = buildUpstreamHeaders(request.headers);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: requestHeaders,
      body: BODYLESS_METHODS.has(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(timeoutMs)
      ])
    });
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: buildClientHeaders(upstreamResponse.headers)
    });
  } catch {
    return Response.json({ error: "API service is unavailable" }, { status: 503 });
  }
}

function buildUpstreamUrl(requestUrl: string, apiPath: string): URL {
  const internalApiUrl = process.env.INTERNAL_API_URL || DEFAULT_INTERNAL_API_URL;
  const upstreamUrl = new URL(apiPath, internalApiUrl);
  upstreamUrl.search = new URL(requestUrl).search;
  return upstreamUrl;
}

function buildUpstreamHeaders(requestHeaders: Headers): Headers {
  const upstreamHeaders = new Headers({ Accept: "application/json" });
  for (const headerName of ["content-type", "cookie"]) {
    const headerValue = requestHeaders.get(headerName);
    if (headerValue) upstreamHeaders.set(headerName, headerValue);
  }
  return upstreamHeaders;
}

function buildClientHeaders(upstreamHeaders: Headers): Headers {
  const clientHeaders = new Headers();
  for (const headerName of ["content-type", "content-disposition"]) {
    const headerValue = upstreamHeaders.get(headerName);
    if (headerValue) clientHeaders.set(headerName, headerValue);
  }
  return clientHeaders;
}
