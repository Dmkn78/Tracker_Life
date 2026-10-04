import { useState, type AnchorHTMLAttributes } from "react";
import { exportMobileReport } from "./reportExport";

export default function MobileLink({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (href === "/api/reports/week" || href?.startsWith("/api/reports/week?")) return <span><a {...props} href={href} aria-busy={busy} onClick={event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    void exportMobileReport(href).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause))).finally(() => setBusy(false));
  }} />{busy ? <span role="status" className="block text-xs">Préparation de l’export…</span> : null}{error ? <span role="alert" className="block text-sm text-risk">{error}</span> : null}</span>;
  return <a {...props} onClick={onClick} href={href?.startsWith("/") ? `#${href}` : href} />;
}
