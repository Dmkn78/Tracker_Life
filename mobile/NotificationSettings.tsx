import { useEffect, useState } from "react";
import { SecondaryButton } from "@/components/ui";
import { disableQuickNotification, enableQuickNotification, getNotificationState, openNotificationSettings } from "./quickCapture";
import type { NotificationSyncState } from "./useNotificationSummary";

export function NotificationSettings({ ready, sync }: { ready: boolean; sync: NotificationSyncState & { refresh(): void } }) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false;
    const read = () => void getNotificationState().then(state => { if (!disposed) { setEnabled(state.enabled); setPermission(state.permissionGranted); } }).catch(() => { if (!disposed) setMessage("État Android indisponible."); });
    read(); document.addEventListener("visibilitychange", read);
    return () => { disposed = true; document.removeEventListener("visibilitychange", read); };
  }, []);
  async function toggle() {
    setBusy(true); setMessage("");
    try {
      if (enabled) { await disableQuickNotification(); setEnabled(false); }
      else { await enableQuickNotification(); const state = await getNotificationState(); setEnabled(state.enabled); setPermission(state.permissionGranted); sync.refresh(); }
    } catch { setMessage("Impossible de modifier la notification. Vérifie les autorisations Android."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Notification des tâches</h2><span className="text-xs text-muted">{enabled && permission ? "Activée" : "Désactivée"}</span></div>
    <p className="text-sm text-muted">Les tâches du jour, leur progression et le bouton + pour ouvrir la Todo.</p>
    {sync.summary && <div className="rounded-xl bg-panel2 p-3"><p className="text-lg font-semibold">{sync.summary.completed} / {sync.summary.total} terminées</p><p className="text-xs text-muted">{sync.summary.date} · {sync.updatedAt ? `actualisé à ${new Date(sync.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>{sync.summary.titles.map((title, index) => <p className="mt-2 truncate text-sm" key={index}>{title}</p>)}</div>}
    {!sync.summary && <p className="text-sm text-muted">{ready ? "En attente de synchronisation avec ton serveur." : "Connecte ton serveur pour récupérer les tâches."}</p>}
    {sync.error && <p role="alert" className="text-sm text-risk">{sync.error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    {!permission && <p className="text-sm text-muted">Les notifications sont bloquées par Android.</p>}
    <div className="flex flex-wrap gap-2">
      <SecondaryButton disabled={busy || (!ready && !enabled)} onClick={() => void toggle()}>{enabled ? "Désactiver" : "Activer le bouton +"}</SecondaryButton>
      <SecondaryButton disabled={!ready || sync.status === "refreshing"} onClick={sync.refresh}>{sync.status === "refreshing" ? "Actualisation…" : "Actualiser le compteur"}</SecondaryButton>
      {!permission && <SecondaryButton onClick={() => void openNotificationSettings().catch(() => setMessage("Ouvre les autorisations de Life Regime dans les réglages Android."))}>Autorisations Android</SecondaryButton>}
    </div>
  </section>;
}
