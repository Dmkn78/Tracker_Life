import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { CheckSquare, CalendarDays, Target, NotebookPen, Menu, Settings, Plus } from "lucide-react";
import { PrimaryButton, SecondaryButton, TextInput, FieldLabel } from "@/components/ui";
import { InterfaceSettingsPanel } from "@/features/settings/components/InterfaceSettingsPanel";
import { TodoClient } from "@/features/todo/components/TodoClient";
import { ObjectivesClient } from "@/features/objectives/components/ObjectivesClient";
import { PerformanceClient } from "@/features/performance/components/PerformanceClient";
import { loadObjectives } from "@/features/objectives/api/objectivesApi";
import type { ObjectivesData } from "@/features/objectives/domain/objective";
import { getIsoWeekId, toDateKey } from "@/lib/dates";
import { requestJson, expectJsonObject } from "@/lib/http/apiClient";
import { connectApi } from "./nativeTransport";
import { normalizeServerAddress } from "./serverAddress";
import { describeConnectionError, type ConnectionStage } from "./connectionError";
import { configureCaptures, disableQuickNotification, listCaptures, showTaskKeyboard, syncCaptures, waitForCaptureSync } from "./quickCapture";
import { notificationDestination } from "./notificationTasks";
import { useNotificationSummary } from "./useNotificationSummary";
import { mobileRouteHref, parseMobileRoute, type MobilePage, type MobileRoute } from "./routes";
import { MOBILE_LOGOUT_EVENT, MOBILE_REFRESH_EVENT, navigateMobile } from "./MobileNavigation";
import { MobileMenu } from "./MobileMenu";
import { AppUpdateControl } from "./AppUpdateControl";
import { InterfaceUpdateControl } from "./InterfaceUpdateControl";
import { NotificationSettings } from "./NotificationSettings";

const MobileFeaturePages = lazy(() => import("./MobileFeaturePages"));
const SERVER_STORAGE_KEY = "life-regime:server";
const HTTP_SERVER_STORAGE_KEY = "life-regime:http-server";
const navigation = [
  { id: "todo", title: "Tâches", icon: CheckSquare },
  { id: "funnel", title: "Planning", icon: CalendarDays },
  { id: "daily-log", title: "Logs", icon: NotebookPen },
  { id: "objectives", title: "Objectifs", icon: Target },
  { id: "more", title: "Plus", icon: Menu }
] as const;

export function MobileApp() {
  const [server, setServer] = useState(localStorage.getItem(SERVER_STORAGE_KEY) ?? (Capacitor.isNativePlatform() ? "" : location.origin));
  const [serverDraft, setServerDraft] = useState(server);
  const [approvedHttpServer, setApprovedHttpServer] = useState(localStorage.getItem(HTTP_SERVER_STORAGE_KEY) ?? "");
  const [allowHttpDraft, setAllowHttpDraft] = useState(Boolean(server && approvedHttpServer === server));
  const [accessKey, setAccessKey] = useState("");
  const [route, setRoute] = useState<MobileRoute>(() => parseMobileRoute(location.hash) ?? { page: server ? "funnel" : "settings", search: "" });
  const page = route.page;
  const setPage = useCallback((destination: MobilePage) => {
    setRoute({ page: destination, search: "" });
    navigateMobile(mobileRouteHref(destination));
  }, []);
  const [ready, setReady] = useState(false);
  const [creationDate, setCreationDate] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isChangingServer = useRef(false);
  const notification = useNotificationSummary(server, ready, revision);

  const requestTaskCreation = useCallback(() => {
    setError(""); setCreationDate(toDateKey()); setPage("todo");
  }, [setPage]);
  const creationOpened = useCallback(() => {
    setCreationDate(null);
    void showTaskKeyboard().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (creationDate) setPage(ready ? "todo" : "settings");
  }, [creationDate, ready, setPage]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const navigate = (url: string) => {
      if (disposed) return;
      const destination = notificationDestination(url);
      if (destination === "create-todo") requestTaskCreation();
      else if (destination === "todo") setPage("todo");
    };
    const listener = App.addListener("appUrlOpen", ({ url }) => navigate(url));
    void App.getLaunchUrl().then(launch => { if (launch?.url) navigate(launch.url); }).catch(() => undefined);
    return () => { disposed = true; void listener.then(handle => handle.remove()); };
  }, [requestTaskCreation, setPage]);

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
    try { connectApi(server, approvedHttpServer === server ? "allow-http" : "https-or-local"); }
    catch (cause) { setError(String(cause)); setPage("settings"); return; }
    void requestJson("/api/settings", expectJsonObject).then(() => configureCaptures(server)).then(() => {
      if (!disposed) { setReady(true); void synchronize(); }
    }).catch((cause: unknown) => { if (!disposed) { setReady(false); setError(describeConnectionError(cause, "session")); setPage("settings"); } });
    const online = () => { void synchronize(); };
    window.addEventListener("online", online);
    const listener = Capacitor.isNativePlatform() ? App.addListener("appStateChange", (state) => {
      if (state.isActive) { setRevision((current) => current + 1); void synchronize(); }
    }) : null;
    return () => { disposed = true; window.removeEventListener("online", online); void listener?.then((handle) => handle.remove()); };
  }, [server, approvedHttpServer, synchronize, setPage]);

  useEffect(() => {
    const navigate = () => {
      const destination = parseMobileRoute(location.hash);
      if (destination) setRoute(destination);
    };
    const refresh = () => setRevision(value => value + 1);
    const logout = () => { setReady(false); setPage("settings"); void disableQuickNotification(); };
    window.addEventListener("hashchange", navigate);
    window.addEventListener(MOBILE_REFRESH_EVENT, refresh);
    window.addEventListener(MOBILE_LOGOUT_EVENT, logout);
    return () => {
      window.removeEventListener("hashchange", navigate);
      window.removeEventListener(MOBILE_REFRESH_EVENT, refresh);
      window.removeEventListener(MOBILE_LOGOUT_EVENT, logout);
    };
  }, [setPage]);

  async function login(event: FormEvent): Promise<void> {
    event.preventDefault(); setBusy(true); setError("");
    isChangingServer.current = true;
    let connected = false;
    let stage: ConnectionStage = "address";
    try {
      await waitForCaptureSync();
      const policy = allowHttpDraft ? "allow-http" : "https-or-local";
      const origin = normalizeServerAddress(serverDraft, policy);
      connectApi(origin, policy);
      stage = "login";
      await requestJson("/api/auth/login", (payload) => {
        if (expectJsonObject(payload).ok !== true) throw new Error("Connexion refusée.");
      }, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessKey }) });
      stage = "session";
      await requestJson("/api/settings", expectJsonObject);
      stage = "capture";
      await configureCaptures(origin);
      localStorage.setItem(SERVER_STORAGE_KEY, origin);
      const approvedOrigin = allowHttpDraft && origin.startsWith("http://") ? origin : "";
      if (approvedOrigin) localStorage.setItem(HTTP_SERVER_STORAGE_KEY, approvedOrigin);
      else localStorage.removeItem(HTTP_SERVER_STORAGE_KEY);
      setApprovedHttpServer(approvedOrigin); setServerDraft(origin);
      setServer(origin); setReady(true); setAccessKey(""); setPage(creationDate ? "todo" : "funnel");
      setRevision((current) => current + 1);
      connected = true;
    } catch (cause) {
      if (server) connectApi(server, approvedHttpServer === server ? "allow-http" : "https-or-local");
      setError(describeConnectionError(cause, stage));
    } finally { isChangingServer.current = false; setBusy(false); if (connected) void synchronize(); }
  }

  function interceptLink(event: MouseEvent): void {
    const anchor = (event.target as Element).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href?.startsWith("/")) return;
    if (parseMobileRoute(href)) {
      event.preventDefault(); navigateMobile(href);
    }
  }

  function interceptNavigationForm(event: FormEvent): void {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const action = form.getAttribute("action");
    if (!action || form.method.toLowerCase() !== "get" || !parseMobileRoute(action)) return;
    event.preventDefault();
    const query = new URLSearchParams();
    new FormData(form).forEach((value, key) => { if (typeof value === "string") query.set(key, value); });
    navigateMobile(`${action}?${query}`);
  }

  return <div className="mobile-app" onClickCapture={interceptLink} onSubmitCapture={interceptNavigationForm}>
    <header className="mobile-header"><span className="font-semibold">Life Regime</span><div className="flex gap-2"><button className="focus-ring rounded-xl p-3" aria-label="Réglages" onClick={() => setPage("settings")}><Settings className="h-5 w-5" /></button><button className="focus-ring rounded-xl bg-accent px-4 py-2 text-onaccent" aria-label="Ajouter rapidement une tâche" disabled={!ready} onClick={requestTaskCreation}><Plus className="h-5 w-5" /></button></div></header>
    <main className="mobile-content">
      {page !== "settings" && <><InterfaceUpdateControl server={server} settings={false} /><AppUpdateControl key={server} server={server} ready={ready} presentation="notice" /></>}
      {message ? <p role="status" className="mb-3 rounded-xl bg-panel2 p-3 text-xs">{message}</p> : null}
      {pending ? <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-panel p-3 text-xs"><span>{pending} capture(s) en attente</span><SecondaryButton onClick={() => void synchronize()}>Synchroniser</SecondaryButton></div> : null}
      {error ? <p role="alert" className="mb-3 text-sm text-risk">{error}</p> : null}
      {ready && page === "todo" ? <TodoClient key="todo" today={toDateKey()} refreshKey={revision} createDate={creationDate} onCreateOpened={creationOpened} /> : null}
      {ready && page === "funnel" ? <TodoClient key="funnel" today={toDateKey()} refreshKey={revision} initialView="funnel" /> : null}
      {ready && page === "objectives" ? <MobileObjectives key={revision} /> : null}
      {ready && page === "performance" ? <PerformanceClient key={revision} /> : null}
      {page === "more" ? <MobileMenu navigate={setPage} /> : null}
      {ready && !["todo", "funnel", "objectives", "performance", "settings", "more"].includes(page) ? <Suspense fallback={<p role="status">Chargement…</p>}><MobileFeaturePages key={`${server}:${page}`} route={route} serverScope={server} /></Suspense> : null}
      {page === "settings" ? <section className="space-y-5">
        <h1 className="text-xl font-semibold">Mon téléphone</h1>
        <InterfaceSettingsPanel />
        {ready ? <Suspense fallback={<p role="status">Chargement des réglages…</p>}><MobileFeaturePages key={server} route={route} /></Suspense> : null}
        <NotificationSettings ready={ready} sync={notification} />
        <form onSubmit={(event) => void login(event)} className="space-y-3 rounded-2xl bg-panel p-4">
          <h2 className="font-semibold">Connexion à mes données</h2><p className="text-sm text-muted">Indique l’adresse de ton site et ta clé d’accès habituelle. Le téléphone et le web partageront les mêmes tâches, objectifs et performances.</p>
          <FieldLabel>Adresse du serveur<TextInput type="url" required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://mon-serveur.fr ou http://IP:port" value={serverDraft} onChange={(event) => { setServerDraft(event.target.value); setAllowHttpDraft(false); }} /></FieldLabel>
          {serverDraft.trim().toLowerCase().startsWith("http://") ? <div className="rounded-xl border border-line bg-panel2 p-3 text-xs">
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={allowHttpDraft} onChange={(event) => setAllowHttpDraft(event.target.checked)} />Autoriser HTTP pour ce serveur</label>
            <p className="text-muted">HTTP transmet la clé et les données sans chiffrement. Préfère HTTPS si ton serveur le propose.</p>
          </div> : null}
          <FieldLabel>Clé d’accès<TextInput type="password" required autoComplete="current-password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} /></FieldLabel>
          <PrimaryButton disabled={busy} type="submit">{busy ? "Connexion…" : "Connecter"}</PrimaryButton>
          <p className="text-xs text-muted">Pour ton VPS, utilise son domaine ou son IP publique, avec le port si nécessaire. Sur ton réseau local, utilise l’IP du PC. 127.0.0.1 désigne le téléphone.</p>
        </form>
        <InterfaceUpdateControl server={server} settings />
        <AppUpdateControl server={server} ready={ready} />
      </section> : !ready ? <p className="text-sm text-muted">Configure la connexion dans Réglages pour commencer.</p> : null}
    </main>
    <nav className="mobile-navigation" aria-label="Navigation principale">{navigation.map(({ id, title: label, icon: Icon }) => <button key={id} aria-current={page === id ? "page" : undefined} className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] ${page === id ? "bg-accent/10 text-accent" : "text-muted"}`} onClick={() => setPage(id)}><Icon className="h-5 w-5" />{label}</button>)}</nav>
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
