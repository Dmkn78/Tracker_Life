import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { CheckSquare, CalendarDays, Target, TrendingUp, Settings, Plus, NotebookPen } from "lucide-react";
import { Drawer, PrimaryButton, SecondaryButton, TextInput, FieldLabel } from "@/components/ui";
import { AppearanceControl } from "@/features/interface/components/AppearanceControl";
import { TodoClient } from "@/features/todo/components/TodoClient";
import { ObjectivesClient } from "@/features/objectives/components/ObjectivesClient";
import { PerformanceClient } from "@/features/performance/components/PerformanceClient";
import { loadObjectives } from "@/features/objectives/api/objectivesApi";
import type { ObjectivesData } from "@/features/objectives/domain/objective";
import { getIsoWeekId, toDateKey } from "@/lib/dates";
import { requestJson, expectJsonObject } from "@/lib/http/apiClient";
import { connectApi } from "./nativeTransport";
import { normalizeConfiguredServerAddress } from "./serverConnection";
import { captureTask, configureCaptures, disableQuickNotification, enableQuickNotification, listCaptures, syncCaptures, waitForCaptureSync } from "./quickCapture";

const MobileDailyLog = lazy(() => import("./MobileDailyLog"));

type Page = "logs" | "todo" | "funnel" | "objectives" | "performance" | "settings";
const SERVER_STORAGE_KEY = "life-regime:server";
const navigation = [
  { id: "todo", title: "Tâches", icon: CheckSquare },
  { id: "funnel", title: "Planning", icon: CalendarDays },
  { id: "objectives", title: "Objectifs", icon: Target },
  { id: "performance", title: "Capital", icon: TrendingUp },
  { id: "logs", title: "Logs", icon: NotebookPen },
  { id: "settings", title: "Réglages", icon: Settings }
] as const;

export function MobileApp() {
  const [server, setServer] = useState(localStorage.getItem(SERVER_STORAGE_KEY) ?? (Capacitor.isNativePlatform() ? "" : location.origin));
  const [serverDraft, setServerDraft] = useState(server);
  const [accessKey, setAccessKey] = useState("");
  const [page, setPage] = useState<Page>(server ? "funnel" : "settings");
  const [ready, setReady] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isChangingServer = useRef(false);

  const synchronize = useCallback(async () => {
    if (!server || isChangingServer.current) return;
    try {
      const sent = await syncCaptures();
      if (sent) { setRevision((current) => current + 1); setMessage(`${sent} tâche(s) ajoutée(s) à l’entonnoir.`); }
      setPending((await listCaptures()).length);
    } catch {
      try { setPending((await listCaptures()).length); }
      catch { setError("Impossible de lire les captures locales. Réessaie après avoir rouvert l’application."); }
      setMessage("Synchronisation indisponible. Les captures restent sur le téléphone ; vérifie la connexion au serveur.");
    }
  }, [server]);

  useEffect(() => {
    let disposed = false;
    if (!server) return;
    try { connectApi(server); }
    catch (cause) { setError(String(cause)); setPage("settings"); return; }
    void configureCaptures(server).then(() => {
      if (!disposed) { setReady(true); void synchronize(); }
    }).catch((cause: unknown) => { if (!disposed) setError(String(cause)); });
    const online = () => { void synchronize(); };
    window.addEventListener("online", online);
    const listener = Capacitor.isNativePlatform() ? App.addListener("appStateChange", (state) => {
      if (state.isActive) { setRevision((current) => current + 1); void synchronize(); }
    }) : null;
    return () => { disposed = true; window.removeEventListener("online", online); void listener?.then((handle) => handle.remove()); };
  }, [server, synchronize]);

  useEffect(() => {
    const navigate = () => {
      const route = location.hash.slice(2);
      if (navigation.some((entry) => entry.id === route)) setPage(route as Page);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  async function login(event: FormEvent): Promise<void> {
    event.preventDefault(); setBusy(true); setError("");
    isChangingServer.current = true;
    let connected = false;
    try {
      await waitForCaptureSync();
      const origin = normalizeConfiguredServerAddress(serverDraft);
      connectApi(origin);
      await requestJson("/api/auth/login", (payload) => {
        if (expectJsonObject(payload).ok !== true) throw new Error("Connexion refusée.");
      }, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessKey }) });
      await loadObjectives(getIsoWeekId(toDateKey()));
      await configureCaptures(origin);
      localStorage.setItem(SERVER_STORAGE_KEY, origin);
      setServer(origin); setReady(true); setAccessKey(""); setPage("funnel");
      setRevision((current) => current + 1);
      connected = true;
    } catch (cause) {
      if (server) connectApi(server);
      setError(cause instanceof Error ? cause.message : "Impossible de joindre le serveur.");
    } finally { isChangingServer.current = false; setBusy(false); if (connected) void synchronize(); }
  }

  async function quickSave(event: FormEvent): Promise<void> {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await captureTask(title);
      setPending((await listCaptures()).length);
      setTitle(""); setQuickOpen(false);
      setMessage("Tâche conservée sur le téléphone.");
      void synchronize();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de conserver la tâche."); }
    finally { setBusy(false); }
  }

  function interceptLink(event: MouseEvent): void {
    const anchor = (event.target as Element).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href?.startsWith("/")) return;
    const destination = href.slice(1).split("?")[0];
    if (navigation.some((entry) => entry.id === destination)) {
      event.preventDefault(); setPage(destination as Page);
    }
  }

  return <div className="mobile-app" onClickCapture={interceptLink}>
    <header className="mobile-header"><span className="font-semibold">Life Regime</span><button className="focus-ring rounded-xl bg-accent px-4 py-2 text-onaccent" aria-label="Ajouter rapidement une tâche" disabled={!ready} onClick={() => { setError(""); setQuickOpen(true); }}><Plus className="h-5 w-5" /></button></header>
    <main className="mobile-content">
      {message ? <p role="status" className="mb-3 rounded-xl bg-panel2 p-3 text-xs">{message}</p> : null}
      {pending ? <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-panel p-3 text-xs"><span>{pending} capture(s) en attente</span><SecondaryButton onClick={() => void synchronize()}>Synchroniser</SecondaryButton></div> : null}
      {error ? <p role="alert" className="mb-3 text-sm text-risk">{error}</p> : null}
      {ready && page === "todo" ? <TodoClient key={`todo-${revision}`} today={toDateKey()} /> : null}
      {ready && page === "funnel" ? <TodoClient key={`funnel-${revision}`} today={toDateKey()} initialView="funnel" /> : null}
      {ready && page === "objectives" ? <MobileObjectives key={revision} /> : null}
      {ready && page === "performance" ? <PerformanceClient key={revision} /> : null}
      {ready && page === "logs" ? <Suspense fallback={<p role="status">Chargement du journal…</p>}><MobileDailyLog key={server} server={server} /></Suspense> : null}
      {page === "settings" ? <section className="space-y-5">
        <h1 className="text-xl font-semibold">Mon téléphone</h1>
        <AppearanceControl />
        <div className="rounded-2xl bg-panel p-4"><h2 className="mb-2 font-semibold">Ajout depuis les notifications</h2><p className="mb-3 text-sm text-muted">Le bouton + ouvre une saisie courte, même hors connexion. Les captures sont synchronisées à la prochaine ouverture connectée.</p><div className="flex flex-wrap gap-2"><SecondaryButton disabled={!ready} onClick={() => { void enableQuickNotification().then((enabled) => setMessage(enabled ? "Le bouton + est disponible dans les notifications." : "Autorise les notifications Android pour afficher le bouton +.")).catch((cause: unknown) => setError(String(cause))); }}>Activer le bouton +</SecondaryButton><SecondaryButton onClick={() => void disableQuickNotification().then(() => setMessage("Raccourci désactivé."))}>Désactiver</SecondaryButton></div></div>
        <form onSubmit={(event) => void login(event)} className="space-y-3 rounded-2xl bg-panel p-4">
          <h2 className="font-semibold">Connexion à mes données</h2><p className="text-sm text-muted">Indique l’adresse de ton API personnelle et ta clé d’accès habituelle. Le téléphone et le web partageront les mêmes tâches, objectifs et performances.</p>
          <FieldLabel>Adresse du serveur<TextInput type="url" required placeholder="http://192.168.1.20:8000" value={serverDraft} onChange={(event) => setServerDraft(event.target.value)} /></FieldLabel>
          {serverDraft.trim().startsWith("http://") ? <p className="text-xs text-muted">Connexion HTTP non chiffrée : la clé d’accès, les données et les enregistrements audio transitent sans chiffrement.</p> : null}
          <FieldLabel>Clé d’accès<TextInput type="password" required autoComplete="current-password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} /></FieldLabel>
          <PrimaryButton disabled={busy} type="submit">{busy ? "Connexion…" : "Connecter"}</PrimaryButton>
          <p className="text-xs text-muted">En Wi-Fi, utilise l’IP locale du PC ; 127.0.0.1 désigne le téléphone. L’API doit rester accessible pour consulter et modifier les données synchronisées.</p>
        </form>
      </section> : !ready ? <p className="text-sm text-muted">Configure la connexion dans Réglages pour commencer.</p> : null}
    </main>
    <nav className="mobile-navigation" aria-label="Navigation principale">{navigation.map(({ id, title: label, icon: Icon }) => <button key={id} aria-current={page === id ? "page" : undefined} className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] ${page === id ? "bg-accent/10 text-accent" : "text-muted"}`} onClick={() => setPage(id)}><Icon className="h-5 w-5" />{label}</button>)}</nav>
    <Drawer open={quickOpen} title="Nouvelle tâche" description="Le détail et la planification peuvent attendre." onClose={() => { if (!busy) setQuickOpen(false); }}>
      {error ? <p role="alert" className="mb-3 text-sm text-risk">{error}</p> : null}
      <form onSubmit={(event) => void quickSave(event)} className="space-y-4"><TextInput aria-label="Titre de la nouvelle tâche" autoFocus required maxLength={500} placeholder="Qu’as-tu à faire ?" value={title} onChange={(event) => setTitle(event.target.value)} /><PrimaryButton type="submit" disabled={busy || !title.trim()}>Ajouter</PrimaryButton></form>
    </Drawer>
  </div>;
}

function MobileObjectives() {
  const [data, setData] = useState<ObjectivesData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void loadObjectives(getIsoWeekId(toDateKey()), controller.signal).then(setData).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(String(cause));
    });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert" className="text-sm text-risk">{error}</p>;
  return data ? <ObjectivesClient initialData={data} /> : <p role="status">Chargement des objectifs…</p>;
}
