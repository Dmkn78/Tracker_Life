"use client";

import { useEffect, useState } from "react";
import { listAiProviders } from "../api/aiProvidersApi";
import { findDefaultProvider, type AiProvider } from "../domain/aiProvider";

export type DefaultAiProviderState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; provider: AiProvider }
  | { kind: "unavailable"; message: string };

/** The provider used when a feature does not pick one explicitly (configured in Settings). */
export function useDefaultAiProvider(): DefaultAiProviderState {
  const [providerState, setProviderState] = useState<DefaultAiProviderState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    listAiProviders(controller.signal)
      .then((catalog) => {
        const provider = findDefaultProvider(catalog.providers);
        setProviderState(provider && provider.model ? { kind: "ready", provider } : { kind: "missing" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setProviderState({ kind: "unavailable", message: error instanceof Error ? error.message : "" });
      });
    return () => controller.abort();
  }, []);

  return providerState;
}
