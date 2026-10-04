import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { parseMobileInterfaceRelease, type MobileInterfaceRelease } from "./interfaceRelease";
import { normalizeServerAddress } from "./serverAddress";

export async function fetchMobileInterfaceRelease(server: string, signal: AbortSignal): Promise<MobileInterfaceRelease | null> {
  const origin = normalizeServerAddress(server, "allow-http");
  const url = `${origin}/mobile-app/release.json?check=${Date.now()}`;
  if (!Capacitor.isNativePlatform()) {
    const response = await fetch(url, { cache: "no-store", signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Impossible de vérifier la publication mobile.");
    return parseMobileInterfaceRelease(await response.json());
  }
  const response = await CapacitorHttp.get({ url, headers: { "Cache-Control": "no-cache", Accept: "application/json" }, responseType: "text", disableRedirects: true, connectTimeout: 10000, readTimeout: 10000 });
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (response.status === 404) return null;
  if (response.status !== 200) throw new Error("Le serveur ne fournit pas la publication mobile à cette adresse.");
  return parseMobileInterfaceRelease(typeof response.data === "string" ? JSON.parse(response.data) : response.data);
}
