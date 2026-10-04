import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { configureApiTransport } from "@/lib/http/apiClient";
import { normalizeServerAddress, type ServerTransportPolicy } from "./serverAddress";
import { serializeNativeRequestBody } from "./nativeRequestBody";

export const TASKS_UPDATED_EVENT = "life-regime:tasks-updated";

export function connectApi(server: string, policy: ServerTransportPolicy = "https-or-local"): void {
  const origin = normalizeServerAddress(server, policy);
  configureApiTransport(async (path, options) => {
    if (!path.startsWith("/api/")) throw new Error("Unexpected API path");
    const url = `${origin}${path}`;
    if (!Capacitor.isNativePlatform()) return fetch(url, options);
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const headers = Object.fromEntries(new Headers(options.headers).entries());
    const body = await serializeNativeRequestBody(options.body);
    if (body.contentType) headers["Content-Type"] = body.contentType;
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const request = CapacitorHttp.request({
      url, method: options.method ?? "GET", headers,
      data: body.data, dataType: body.dataType,
      responseType: "text", connectTimeout: 15000, readTimeout: path === "/api/transcribe" || path === "/api/assistant/preview" ? 190000 : path === "/api/transcription-jobs" ? 610000 : path === "/api/mobile-update" ? 45000 : path === "/api/assistant/models" ? 30000 : 15000,
      disableRedirects: true
    });
    // Native HTTP has bounded timeouts but cannot be cancelled at the socket level.
    let abortNativeWait: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      abortNativeWait = () => reject(new DOMException("Aborted", "AbortError"));
      options.signal?.addEventListener("abort", abortNativeWait, { once: true });
    });
    const response = await Promise.race([request, aborted]).finally(() => {
      if (abortNativeWait) options.signal?.removeEventListener("abort", abortNativeWait);
    });
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (response.status >= 300 && response.status < 400) {
      throw new Error("Le serveur redirige la connexion. Renseigne son adresse finale, notamment https:// s’il impose HTTPS.");
    }
    if (response.status >= 200 && response.status < 300 && path.startsWith("/api/tasks") && options.method && options.method.toUpperCase() !== "GET") {
      window.dispatchEvent(new Event(TASKS_UPDATED_EVENT));
    }
    return new Response(typeof response.data === "string" ? response.data : JSON.stringify(response.data), {
      status: response.status, headers: response.headers
    });
  });
}
