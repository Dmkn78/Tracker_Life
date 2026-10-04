"use client";

import { Bot, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FieldLabel, Panel, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { listAssistantModels } from "../api/assistantApi";
import { DEFAULT_ASSISTANT_PROVIDER, readAssistantProvider, writeAssistantProvider } from "../application/assistantPreferences";
import type { AssistantProvider } from "../domain/assistant";
import { ASSISTANT_COPY } from "./assistantCopy";

export function AssistantSettingsPanel(): React.ReactElement {
  const { locale } = useLocale();
  const copy = ASSISTANT_COPY[locale];
  const [provider, setProvider] = useState<AssistantProvider>(DEFAULT_ASSISTANT_PROVIDER);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    setProvider(readAssistantProvider());
    return () => { generationRef.current += 1; requestRef.current?.abort(); };
  }, []);

  function updateProvider(patch: Partial<AssistantProvider>): void {
    generationRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
    setProvider((current) => ({ ...current, ...patch }));
    if (patch.baseUrl !== undefined || patch.apiKey !== undefined) setModels([]);
    setError("");
    setStatus("");
  }

  async function testConnection(): Promise<void> {
    if (requestRef.current) return;
    const controller = new AbortController();
    const generation = ++generationRef.current;
    requestRef.current = controller;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const availableModels = await listAssistantModels({ ...provider, baseUrl: provider.baseUrl.trim() }, controller.signal);
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setModels(availableModels);
      if (availableModels.length && !availableModels.includes(provider.model)) setProvider((current) => ({ ...current, model: availableModels[0] }));
      setStatus(availableModels.length ? copy.connected : copy.noModels);
    } catch (cause: unknown) {
      if (!controller.signal.aborted && generation === generationRef.current) setError(cause instanceof Error ? cause.message : copy.failed);
    } finally {
      if (generation === generationRef.current) { setBusy(false); requestRef.current = null; }
    }
  }

  function saveConnection(): void {
    const persisted = writeAssistantProvider({ baseUrl: provider.baseUrl.trim(), model: provider.model.trim(), apiKey: provider.apiKey?.trim() });
    setError("");
    setStatus(persisted ? copy.settingsSaved : copy.sessionOnly);
  }

  return <Panel>
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-violet/15 text-violet"><Bot className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-ink">{copy.settingsTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{copy.settingsDescription}</p>
        <div className="mt-4 space-y-4">
          <FieldLabel className="block">{copy.server}<TextInput className="mt-2" type="url" value={provider.baseUrl} onChange={(event) => updateProvider({ baseUrl: event.target.value })} placeholder={DEFAULT_ASSISTANT_PROVIDER.baseUrl} /></FieldLabel>
          <FieldLabel className="block">{copy.key}<TextInput className="mt-2" type="password" autoComplete="off" value={provider.apiKey ?? ""} onChange={(event) => updateProvider({ apiKey: event.target.value })} /></FieldLabel>
          <SecondaryButton type="button" disabled={busy || !provider.baseUrl.trim()} onClick={() => void testConnection()}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? copy.testing : copy.test}</SecondaryButton>
          <FieldLabel className="block">{copy.model}{models.length ? <SelectInput className="mt-2" value={provider.model} onChange={(event) => updateProvider({ model: event.target.value })}>{models.map((model) => <option key={model} value={model}>{model}</option>)}</SelectInput> : <TextInput className="mt-2" value={provider.model} onChange={(event) => updateProvider({ model: event.target.value })} placeholder={copy.modelPlaceholder} />}</FieldLabel>
          <PrimaryButton type="button" disabled={busy || !provider.baseUrl.trim() || !provider.model.trim()} onClick={saveConnection}>{copy.saveSettings}</PrimaryButton>
          <p className="text-xs leading-5 text-muted">{copy.network}</p>
          {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
          {status ? <p role="status" className="text-sm text-muted">{status}</p> : null}
        </div>
      </div>
    </div>
  </Panel>;
}
