"use client";

import { Bot, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Panel, PrimaryButton } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { deleteAiProvider, listAiProviders, updateAiProvider, type AiProviderPatch } from "../api/aiProvidersApi";
import type { AiProviderCatalog } from "../domain/aiProvider";
import { AiProviderForm } from "./AiProviderForm";
import { AiProviderRow } from "./AiProviderRow";
import { AI_PROVIDERS_COPY } from "./aiProvidersCopy";

export function AiProvidersPanel(): React.ReactElement {
  const { locale } = useLocale();
  const copy = AI_PROVIDERS_COPY[locale];
  const [catalog, setCatalog] = useState<AiProviderCatalog | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    listAiProviders(controller.signal).then(setCatalog).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : copy.failed);
    });
    return () => controller.abort();
  }, [copy.failed]);

  async function reload(): Promise<void> {
    setCatalog(await listAiProviders());
  }

  async function runAction(action: () => Promise<unknown>): Promise<void> {
    setError("");
    try {
      await action();
      await reload();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : copy.failed);
    }
  }

  const patchProvider = (patch: AiProviderPatch) => runAction(() => updateAiProvider(patch));
  const removeProvider = (id: string) => window.confirm(copy.confirmRemove) ? runAction(() => deleteAiProvider(id)) : Promise.resolve();

  return (
    <Panel className="lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">{copy.eyebrow}</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-ink"><Bot className="h-5 w-5" />{copy.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{copy.description}</p>
        </div>
        {!isAdding && catalog ? <PrimaryButton type="button" onClick={() => setIsAdding(true)}><Plus className="h-4 w-4" />{copy.add}</PrimaryButton> : null}
      </div>
      {error ? <p role="alert" className="mb-3 text-sm text-risk">{error}</p> : null}
      {isAdding && catalog ? (
        <div className="mb-4">
          <AiProviderForm presets={catalog.presets} copy={copy} onCancel={() => setIsAdding(false)} onCreated={() => { setIsAdding(false); void reload(); }} />
        </div>
      ) : null}
      {catalog && catalog.providers.length === 0 && !isAdding ? <p className="text-sm text-muted">{copy.empty}</p> : null}
      <ul className="grid gap-3">
        {catalog?.providers.map((provider) => (
          <AiProviderRow
            key={provider.id}
            provider={provider}
            copy={copy}
            onModelChange={(model) => void patchProvider({ id: provider.id, model })}
            onMakeDefault={() => void patchProvider({ id: provider.id, isDefault: true })}
            onRemove={() => void removeProvider(provider.id)}
          />
        ))}
      </ul>
    </Panel>
  );
}
