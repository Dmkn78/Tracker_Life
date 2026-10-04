"use client";

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { readWebsiteVersion } from "../domain/websiteVersion";

const CHECK_INTERVAL_MS = 60_000;
const LOADED_VERSION = process.env.NEXT_PUBLIC_WEBSITE_VERSION ?? "";

export function useWebsiteVersion(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let request: AbortController | undefined;
    let disposed = false;
    async function check(): Promise<void> {
      if (request || disposed || document.visibilityState === "hidden") return;
      request = new AbortController();
      const timeout = setTimeout(() => request?.abort(), 10_000);
      try {
        const response = await fetch("/api/app-version", { cache: "no-store", credentials: "same-origin", signal: request.signal });
        if (!response.ok) return;
        const version = readWebsiteVersion(await response.json());
        if (!disposed && version && LOADED_VERSION) setAvailable(version !== LOADED_VERSION);
      } catch { /* A connectivity failure is not a new deployment. */ }
      finally { clearTimeout(timeout); request = undefined; }
    }
    const checkVisible = () => { void check(); };
    const listener = App.addListener("appStateChange", state => { if (state.isActive) checkVisible(); });
    const timer = setInterval(checkVisible, CHECK_INTERVAL_MS);
    window.addEventListener("online", checkVisible);
    document.addEventListener("visibilitychange", checkVisible);
    checkVisible();
    return () => {
      disposed = true; request?.abort(); clearInterval(timer);
      window.removeEventListener("online", checkVisible);
      document.removeEventListener("visibilitychange", checkVisible);
      void listener.then(handle => handle.remove());
    };
  }, []);
  return available;
}
