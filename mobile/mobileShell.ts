import { Capacitor, registerPlugin } from "@capacitor/core";

export type MobileShellStatus = { server: string; hosted: boolean; fallbackReason: string; theme?: string; locale?: string };
const native = registerPlugin<{
  status(): Promise<MobileShellStatus>;
  ready(): Promise<void>;
  openPublished(options: { server: string; theme: string; locale: string }): Promise<void>;
  useBundled(options: { theme: string; locale: string }): Promise<void>;
}>("MobileShell");

export function getMobileShellStatus(): Promise<MobileShellStatus> {
  return Capacitor.isNativePlatform() ? native.status() : Promise.resolve({ server: location.origin, hosted: false, fallbackReason: "" });
}
export async function acknowledgeMobileReady(): Promise<void> {
  if (Capacitor.isNativePlatform()) await native.ready();
}
export async function openPublishedInterface(server: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await native.openPublished({ server, theme: localStorage.getItem("theme") ?? "cream", locale: localStorage.getItem("life-regime:locale") ?? "fr" });
}
export async function useBundledInterface(): Promise<void> {
  if (Capacitor.isNativePlatform()) await native.useBundled({ theme: localStorage.getItem("theme") ?? "cream", locale: localStorage.getItem("life-regime:locale") ?? "fr" });
}

export async function restoreMobileConnection(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const status = await getMobileShellStatus();
  if (status.theme) localStorage.setItem("theme", status.theme);
  if (status.locale) localStorage.setItem("life-regime:locale", status.locale);
  if (status.server) {
    localStorage.setItem("life-regime:server", status.server);
    if (status.server.startsWith("http://")) localStorage.setItem("life-regime:http-server", status.server);
  }
}
