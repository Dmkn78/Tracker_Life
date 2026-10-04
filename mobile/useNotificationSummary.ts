import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { listTodoTasks } from "@/features/todo/api/todoApi";
import { ApiError } from "@/lib/http/apiClient";
import { toDateKey } from "@/lib/dates";
import { TASKS_UPDATED_EVENT } from "./nativeTransport";
import { updateNotificationSummary, markNotificationSyncError } from "./quickCapture";
import { summarizeNotificationTasks, type NotificationTaskSummary } from "./notificationTasks";

export type NotificationSyncState = {
  status: "idle" | "refreshing" | "synced" | "error";
  summary: NotificationTaskSummary | null;
  updatedAt: number | null;
  error: string;
};

export function useNotificationSummary(server: string, ready: boolean, revision: number) {
  const [state, setState] = useState<NotificationSyncState>({ status: "idle", summary: null, updatedAt: null, error: "" });
  const [requested, setRequested] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(() => setRequested(value => value + 1), []);
  useEffect(() => {
    setState({ status: "idle", summary: null, updatedAt: null, error: "" });
  }, [server, ready]);
  useEffect(() => {
    const currentGeneration = ++generation.current;
    if (!server || !ready || !Capacitor.isNativePlatform()) return;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function update(): Promise<void> {
      controller?.abort();
      const request = new AbortController(); controller = request;
      setState(previous => ({ ...previous, status: "refreshing", error: "" }));
      try {
        const date = toDateKey();
        const tasks = await listTodoTasks({ date, scope: "today", signal: request.signal });
        if (request.signal.aborted || currentGeneration !== generation.current) return;
        const summary = summarizeNotificationTasks(tasks, date);
        await updateNotificationSummary(server, summary);
        if (!request.signal.aborted && currentGeneration === generation.current) setState({ status: "synced", summary, updatedAt: Date.now(), error: "" });
      } catch (error) {
        if (request.signal.aborted || currentGeneration !== generation.current) return;
        const message = error instanceof ApiError && error.status === 401 ? "Session expirée : reconnecte ton serveur dans les paramètres." : "Le compteur n’a pas pu être synchronisé. Vérifie la connexion puis réessaie.";
        setState(previous => ({ ...previous, status: "error", error: message }));
        void markNotificationSyncError(server, message).catch(() => undefined);
      }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void update(), 250); };
    const visible = () => { if (document.visibilityState !== "hidden") schedule(); };
    schedule();
    const interval = setInterval(visible, 30_000);
    window.addEventListener(TASKS_UPDATED_EVENT, schedule);
    window.addEventListener("life-regime:api-write", schedule);
    window.addEventListener("online", schedule);
    document.addEventListener("visibilitychange", visible);
    return () => { generation.current++; clearTimeout(timer); clearInterval(interval); controller?.abort(); window.removeEventListener(TASKS_UPDATED_EVENT, schedule); window.removeEventListener("life-regime:api-write", schedule); window.removeEventListener("online", schedule); document.removeEventListener("visibilitychange", visible); };
  }, [server, ready, revision, requested]);
  return { ...state, refresh };
}
