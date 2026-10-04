import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SecondaryButton } from "@/components/ui";
import { MOBILE_BUILD_TIME, MOBILE_BUILD_VERSION } from "./buildInfo";
import type { MobileInterfaceRelease } from "./interfaceRelease";
import { fetchMobileInterfaceRelease } from "./interfaceReleaseApi";
import { getMobileShellStatus, openPublishedInterface, useBundledInterface, type MobileShellStatus } from "./mobileShell";

export function InterfaceUpdateControl({ server, settings }: { server: string; settings: boolean }) {
  const [shell, setShell] = useState<MobileShellStatus | null>(null);
  const [release, setRelease] = useState<MobileInterfaceRelease | null>(null);
  const [nativeBuild, setNativeBuild] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const lastCheck = useRef(0);
  useEffect(() => {
    let disposed = false;
    if (Capacitor.isNativePlatform()) {
      void getMobileShellStatus().then(status => { if (!disposed) setShell(status); }).catch(() => undefined);
      void App.getInfo().then(info => { if (!disposed) setNativeBuild(Number(info.build)); }).catch(() => undefined);
    }
    return () => { disposed = true; };
  }, []);
  const check = useCallback(async () => {
    if (!server || request.current) return;
    const controller = new AbortController(); request.current = controller; lastCheck.current = Date.now();
    setBusy(true); setMessage("");
    try {
      const next = await fetchMobileInterfaceRelease(server, controller.signal);
      if (!controller.signal.aborted) {
        setRelease(next);
        setMessage(!next ? "L’interface mobile n’est pas encore publiée sur ce serveur. La version intégrée reste utilisable." : next.version === MOBILE_BUILD_VERSION ? "Interface à jour." : "Une interface mobile est disponible sur le serveur.");
      }
    } catch {
      if (!controller.signal.aborted) setMessage("Vérification impossible. Ta version actuelle reste disponible ; vérifie la connexion au serveur.");
    } finally { if (request.current === controller) request.current = null; if (!controller.signal.aborted) setBusy(false); }
  }, [server]);
  useEffect(() => {
    setRelease(null); setMessage(""); lastCheck.current = 0;
    if (!Capacitor.isNativePlatform() || !server) return;
    const automatic = () => { if (Date.now() - lastCheck.current >= 60_000) void check(); };
    automatic();
    const listener = App.addListener("appStateChange", state => { if (state.isActive) automatic(); });
    window.addEventListener("online", automatic);
    const interval = setInterval(() => { if (document.visibilityState !== "hidden") automatic(); }, 60_000);
    return () => { request.current?.abort(); request.current = null; clearInterval(interval); window.removeEventListener("online", automatic); void listener.then(handle => handle.remove()); };
  }, [server, check]);
  const available = release && release.version !== MOBILE_BUILD_VERSION;
  async function open(): Promise<void> {
    if (!release || nativeBuild < release.minNativeBuild) return;
    if (!window.confirm("Ouvrir l’interface mobile publiée ? Enregistre d’abord ta saisie ou termine ta dictée.")) return;
    setBusy(true);
    try { await openPublishedInterface(server); } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible d’ouvrir la mise à jour."); }
    finally { setBusy(false); }
  }
  if (!Capacitor.isNativePlatform() || (!settings && !available && !shell?.fallbackReason)) return null;
  return <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
    <h2 className="font-semibold">Interface mobile</h2>
    {settings && <p className="text-sm text-muted">{shell?.hosted ? "Version publiée par ton site" : "Version intégrée au téléphone"}{MOBILE_BUILD_TIME ? ` · ${new Date(MOBILE_BUILD_TIME).toLocaleDateString("fr-FR")}` : ""}. Les données viennent de ton serveur.</p>}
    {shell?.fallbackReason && <p role="status" className="text-sm text-muted">{shell.fallbackReason}</p>}
    {(settings || available) && message && <p role="status" className="text-sm text-muted">{message}</p>}
    {available && nativeBuild < release.minNativeBuild && <p className="text-sm text-muted">Cette interface nécessite une nouvelle APK. Utilise la section Application Android ci-dessous.</p>}
    <div className="flex flex-wrap gap-2">
      {settings && <SecondaryButton disabled={busy || !server} onClick={() => void check()}>Vérifier l’interface</SecondaryButton>}
      {available && <SecondaryButton disabled={busy || nativeBuild < release.minNativeBuild} onClick={() => void open()}>Mettre à jour l’interface</SecondaryButton>}
      {settings && shell?.hosted && <SecondaryButton onClick={() => { if (window.confirm("Revenir à l’interface intégrée ? Enregistre ta saisie avant de continuer.")) void useBundledInterface().catch(() => setMessage("Impossible de revenir à la version intégrée.")); }}>Utiliser la version intégrée</SecondaryButton>}
    </div>
  </section>;
}
