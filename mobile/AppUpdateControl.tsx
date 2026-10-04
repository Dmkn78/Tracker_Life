import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Panel, PrimaryButton, SecondaryButton } from "@/components/ui";
import { ApiError, requestJson } from "@/lib/http/apiClient";
import { isNewerRelease, MAX_ANDROID_VERSION_CODE, parseAppRelease, type AppRelease } from "./appUpdate";

const AppUpdater = registerPlugin<{ install: (options: { server: string; sha256: string; versionCode: number; version: string; size: number }) => Promise<{ permissionRequired: boolean }> }>("AppUpdater");
const AUTO_UPDATE_CHECK_INTERVAL_MS = 30_000;
const RELEASE_CHECK_TIMEOUT_MS = 45_000;

export function AppUpdateControl({ server, ready, presentation = "settings" }: { server: string; ready: boolean; presentation?: "settings" | "notice" }) {
  const [installed, setInstalled] = useState<{ version: string; code: number } | null>(null);
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const installationRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const lastCheckRef = useRef(0);
  const contextRef = useRef({ server, ready, mounted: false });
  useEffect(() => {
    let disposed = false;
    contextRef.current.mounted = true;
    if (Capacitor.isNativePlatform()) void App.getInfo().then(info => {
      const code = Number(info.build);
      if (!Number.isInteger(code) || code < 1 || code > MAX_ANDROID_VERSION_CODE) throw new Error("Version Android invalide.");
      if (!disposed) setInstalled({ version: info.version, code });
    }).catch(() => { if (!disposed) setError("Impossible de lire la version installée."); });
    return () => { disposed = true; contextRef.current.mounted = false; requestRef.current?.abort(); };
  }, []);
  useEffect(() => {
    contextRef.current.server = server;
    contextRef.current.ready = ready;
    requestRef.current?.abort(); requestRef.current = null;
    lastCheckRef.current = 0;
    setRelease(null); setStatus(""); setError(""); setBusy(installationRef.current);
  }, [server, ready]);

  const check = useCallback(async (): Promise<void> => {
    if (!ready || !server || requestRef.current || installationRef.current) return;
    lastCheckRef.current = Date.now();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError(""); setStatus(""); setRelease(null);
    try {
      const nextRelease = await requestJson("/api/mobile-update", parseAppRelease, { cache: "no-store", signal: controller.signal, timeoutMs: RELEASE_CHECK_TIMEOUT_MS });
      if (controller.signal.aborted) return;
      setRelease(nextRelease);
      setStatus(!nextRelease ? "Aucun APK publié. La publication GitHub est peut-être encore en cours." : !installed ? "Version publiée trouvée. Lecture de la version installée en cours…" : isNewerRelease(nextRelease, installed.code) ? "Une mise à jour est disponible." : "L’application est à jour.");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof ApiError && cause.status === 404 ? "Le serveur ne propose pas encore les mises à jour. Déploie la nouvelle version du site et publie l’APK GitHub." : cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; if (contextRef.current.mounted) setBusy(installationRef.current); }
    }
  }, [ready, installed, server]);

  useEffect(() => {
    if (!ready || !installed || !Capacitor.isNativePlatform()) return;
    const automaticCheck = () => { if (Date.now() - lastCheckRef.current >= AUTO_UPDATE_CHECK_INTERVAL_MS) void check(); };
    automaticCheck();
    const listener = App.addListener("appStateChange", state => { if (state.isActive) automaticCheck(); });
    window.addEventListener("online", automaticCheck);
    return () => {
      requestRef.current?.abort(); requestRef.current = null;
      window.removeEventListener("online", automaticCheck);
      void listener.then(handle => handle.remove());
    };
  }, [ready, installed, check]);

  async function install(): Promise<void> {
    if (!ready || !installed || !release || !isNewerRelease(release, installed.code) || requestRef.current || installationRef.current) return;
    installationRef.current = true;
    setBusy(true); setError(""); setStatus("Téléchargement et vérification de l’APK…");
    try {
      const result = await AppUpdater.install({ server, sha256: release.sha256, versionCode: release.versionCode, version: release.version, size: release.size });
      if (!contextRef.current.mounted || contextRef.current.server !== server || !contextRef.current.ready) return;
      setStatus(result.permissionRequired ? "Autorise Life Regime à installer des applications, reviens ici, puis touche à nouveau Installer." : "Confirme la mise à jour dans la fenêtre Android. Si tu l’annules, tu peux réessayer ici.");
    } catch (cause) {
      if (contextRef.current.mounted && contextRef.current.server === server && contextRef.current.ready) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus(""); }
    }
    finally { installationRef.current = false; if (contextRef.current.mounted) setBusy(requestRef.current !== null); }
  }

  const available = installed && release && isNewerRelease(release, installed.code);
  const canInstallNatively = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AppUpdater");
  const installAction = available && (canInstallNatively
    ? <PrimaryButton disabled={!ready || busy} onClick={() => void install()}>{busy ? "Opération en cours…" : "Télécharger et installer"}</PrimaryButton>
    : <a href={`${server}${release.apkPath}`} target="_blank" rel="noreferrer" className="focus-ring rounded-lg bg-accent px-4 py-2 font-semibold text-white">Télécharger l’APK</a>);
  const manualInstallNotice = available && !canInstallNatively ? <p className="mt-2 text-sm text-muted">Télécharge l’APK dans le navigateur, puis ouvre le fichier pour confirmer la mise à jour Android. Les prochaines installations pourront être lancées ici.</p> : null;
  if (presentation === "notice") return available ? <Panel className="mb-4"><div className="flex flex-wrap items-center justify-between gap-3"><span>Life Regime {release.version} est disponible.</span>{installAction}</div>{manualInstallNotice}{status ? <p role="status" className="mt-2 text-sm text-muted">{status}</p> : null}{error ? <p role="alert" className="mt-2 text-sm text-risk">{error}</p> : null}</Panel> : null;
  return <Panel className="mb-4"><h2 className="font-semibold">Version et mises à jour</h2><p className="mt-2 text-sm">Version installée : {installed ? `${installed.version} (${installed.code})` : Capacitor.isNativePlatform() ? "Lecture…" : "aperçu web"}</p><p className="mt-2 text-sm text-muted">Recherche automatique à l’ouverture et au retour dans l’application. Ton serveur vérifie les APK publiés sur GitHub et propose la dernière version. Android demande de confirmer son installation.</p>{release ? <p className="mt-2 text-sm">Version publiée : {release.version}</p> : null}<div className="mt-3 flex flex-wrap gap-2"><SecondaryButton disabled={!ready || !server || busy} onClick={() => void check()}>{busy ? "Opération en cours…" : "Rechercher une mise à jour"}</SecondaryButton>{installAction}</div>{manualInstallNotice}{status ? <p role="status" className="mt-3 text-sm text-muted">{status}</p> : null}{error ? <p role="alert" className="mt-3 text-sm text-risk">{error}</p> : null}</Panel>;
}
