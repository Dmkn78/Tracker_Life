"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { listTodoTasks } from "@/features/todo/api/todoApi";
import { toDateKey } from "@/lib/dates";
import { configureCaptures, syncCaptures, updateNotificationSummary } from "@/mobile/quickCapture";
import { summarizeNotificationTasks } from "@/mobile/notificationTasks";
import { exportMobileReport } from "@/mobile/reportExport";
import { AppUpdateControl } from "@/mobile/AppUpdateControl";
import { useWebsiteVersion } from "./useWebsiteVersion";

export function AndroidWebsiteBridge() {
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(Capacitor.isNativePlatform()); }, []);
  return native ? <ConnectedAndroidWebsite /> : null;
}

function ConnectedAndroidWebsite() {
  const pathname = usePathname();
  const ready = pathname !== "/login";
  const [error, setError] = useState("");
  const updateAvailable = useWebsiteVersion();

  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let refreshing = false;
    let controller: AbortController | undefined;
    const configured = configureCaptures(location.origin);
    async function refresh(): Promise<void> {
      if (refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      controller = new AbortController();
      try {
        await configured;
        if (disposed) return;
        await syncCaptures();
        if (disposed) return;
        const date = toDateKey();
        const tasks = await listTodoTasks({ date, scope: "today", signal: controller.signal });
        if (!disposed) await updateNotificationSummary(location.origin, summarizeNotificationTasks(tasks, date));
      } catch { /* Retain the last dated notification snapshot while offline or signed out. */ }
      finally { refreshing = false; }
    }
    const refreshVisible = () => { void refresh(); };
    const listener = App.addListener("appStateChange", state => { if (state.isActive) refreshVisible(); });
    refreshVisible();
    const interval = setInterval(refreshVisible, 30_000);
    window.addEventListener("life-regime:api-write", refreshVisible);
    window.addEventListener("online", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      disposed = true; controller?.abort(); clearInterval(interval);
      window.removeEventListener("life-regime:api-write", refreshVisible);
      window.removeEventListener("online", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      void listener.then(handle => handle.remove());
    };
  }, [ready]);

  useEffect(() => {
    const exportReport = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || url.pathname !== "/api/reports/week") return;
      event.preventDefault(); setError("");
      void exportMobileReport(url.href).catch(() => setError("Impossible d’exporter le rapport. Réessaie après avoir vérifié la connexion."));
    };
    document.addEventListener("click", exportReport, true);
    return () => document.removeEventListener("click", exportReport, true);
  }, []);

  return <>
    {updateAvailable && <aside role="status" className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel p-3 text-sm text-slate-100">
      <span>Une nouvelle version du site est disponible. Termine ta saisie ou ta dictée avant de l’ouvrir.</span>
      <button className="focus-ring rounded-md bg-accent px-3 py-2 text-white" onClick={() => location.reload()}>Ouvrir la nouvelle version</button>
    </aside>}
    {error && <p role="alert" className="bg-panel p-3 text-risk">{error}</p>}
    <AppUpdateControl server={location.origin} ready={ready} presentation={pathname === "/settings" ? "settings" : "notice"} />
  </>;
}
