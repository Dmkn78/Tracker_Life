import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { configureApiTransport } from "@/lib/http/apiClient";
import { serializeFormData } from "./formDataTransport";
import { normalizeServerAddress } from "./serverAddress";

export function connectApi(server: string): void {
  const origin = normalizeServerAddress(server);
  configureApiTransport(async (path, options) => {
    if (!path.startsWith("/api/")) throw new Error("Unexpected API path");
    const url = `${origin}${path}`;
    if (!Capacitor.isNativePlatform()) return fetch(url, options);
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const headers = Object.fromEntries(new Headers(options.headers).entries());
    const isAudioUpload = options.body instanceof FormData;
    const data = isAudioUpload ? await serializeFormData(options.body as FormData)
      : typeof options.body === "string" ? JSON.parse(options.body) : undefined;
    if (isAudioUpload) headers["Content-Type"] = "multipart/form-data";
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const request = CapacitorHttp.request({
      url, method: options.method ?? "GET", headers,
      data, dataType: isAudioUpload ? "formData" : undefined,
      responseType: "text", connectTimeout: 15000, readTimeout: isAudioUpload ? 190000 : 15000,
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
    return new Response(typeof response.data === "string" ? response.data : JSON.stringify(response.data), {
      status: response.status, headers: response.headers
    });
  });
}
