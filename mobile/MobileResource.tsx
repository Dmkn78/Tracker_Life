import { useEffect, useState, type ReactNode } from "react";
import { SecondaryButton } from "@/components/ui";

export function MobileResource<T>({ load, children }: { load: (signal: AbortSignal) => Promise<T>; children: (data: T) => ReactNode }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "loaded"; data: T } | { status: "failed"; error: string }>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void load(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ status: "loaded", data });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setState({ status: "failed", error: cause instanceof Error ? cause.message : String(cause) });
    });
    return () => controller.abort();
  }, [load, attempt]);
  if (state.status === "loading") return <p role="status">Chargement…</p>;
  if (state.status === "failed") return <div className="space-y-3"><p role="alert" className="text-risk">{state.error}</p><SecondaryButton onClick={() => setAttempt(value => value + 1)}>Réessayer</SecondaryButton></div>;
  return children(state.data);
}
