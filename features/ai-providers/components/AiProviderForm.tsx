"use client";

import { LoaderCircle, PlugZap } from "lucide-react";
import { useRef, useState } from "react";
import { FieldLabel, PrimaryButton, SecondaryButton, SegmentedButton, TextInput } from "@/components/ui";
import { createAiProvider, testDraftConnection } from "../api/aiProvidersApi";
import { isDraftReadyToTest, type AiProvider, type AiProviderDraft, type AiProviderPreset } from "../domain/aiProvider";
import type { AiProvidersCopy } from "./aiProvidersCopy";
import { ModelPicker } from "./ModelPicker";

type TestState = { kind: "idle" } | { kind: "testing" } | { kind: "connected"; models: string[]; latencyMs: number } | { kind: "failed"; message: string };

export function AiProviderForm({ presets, copy, onCreated, onCancel }: {
  presets: AiProviderPreset[];
  copy: AiProvidersCopy;
  onCreated: (provider: AiProvider) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [draft, setDraft] = useState<AiProviderDraft>({ kind: presets[0]?.kind ?? "lmstudio", baseUrl: "", apiKey: "", model: "", label: "" });
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const testRequest = useRef<AbortController | null>(null);
  const preset = presets.find((candidate) => candidate.kind === draft.kind) ?? presets[0];
  const isCustomEndpoint = preset ? !preset.defaultBaseUrl : false;

  function changeDraft(change: Partial<AiProviderDraft>): void {
    testRequest.current?.abort();
    setDraft((current) => ({ ...current, ...change }));
    if (change.kind || change.baseUrl !== undefined || change.apiKey !== undefined) setTestState({ kind: "idle" });
  }

  async function testConnection(): Promise<void> {
    testRequest.current?.abort();
    const controller = new AbortController();
    testRequest.current = controller;
    setTestState({ kind: "testing" });
    try {
      const result = await testDraftConnection(draft, controller.signal);
      setTestState({ kind: "connected", models: result.models, latencyMs: result.latencyMs });
      setDraft((current) => ({ ...current, model: current.model || result.models[0] || "" }));
    } catch (error: unknown) {
      if (!controller.signal.aborted) setTestState({ kind: "failed", message: error instanceof Error ? error.message : copy.failed });
    }
  }

  async function save(): Promise<void> {
    setIsSaving(true);
    setSaveError("");
    try {
      onCreated(await createAiProvider(draft));
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : copy.failed);
    } finally {
      setIsSaving(false);
    }
  }

  if (!preset) return <p className="text-sm text-muted">{copy.failed}</p>;
  const discoveredModels = testState.kind === "connected" ? testState.models : [];
  return (
    <div className="grid gap-4 rounded-[20px] bg-panel2/60 p-4 ring-1 ring-line">
      <div>
        <FieldLabel>{copy.chooseProvider}</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={copy.chooseProvider}>
          {presets.map((candidate) => (
            <SegmentedButton key={candidate.kind} type="button" active={candidate.kind === draft.kind} onClick={() => changeDraft({ kind: candidate.kind, baseUrl: "", model: "" })} className="ring-1 ring-line">
              {candidate.label}
            </SegmentedButton>
          ))}
        </div>
      </div>
      {preset.requiresApiKey || !preset.isLocal ? (
        <label className="grid gap-1.5">
          <FieldLabel>{preset.requiresApiKey ? copy.apiKey : copy.apiKeyOptional}</FieldLabel>
          <TextInput type="password" autoComplete="off" placeholder={copy.apiKeyPlaceholder} value={draft.apiKey} onChange={(event) => changeDraft({ apiKey: event.target.value })} />
        </label>
      ) : null}
      <BaseUrlField preset={preset} copy={copy} value={draft.baseUrl} isRequired={isCustomEndpoint} onChange={(baseUrl) => changeDraft({ baseUrl })} />
      <div className="flex flex-wrap items-center gap-3">
        <SecondaryButton type="button" disabled={!isDraftReadyToTest(draft, preset) || testState.kind === "testing"} onClick={() => void testConnection()}>
          {testState.kind === "testing" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
          {testState.kind === "testing" ? copy.testing : copy.test}
        </SecondaryButton>
        <TestStatus state={testState} copy={copy} />
      </div>
      {testState.kind === "connected" ? (
        <label className="grid gap-1.5">
          <FieldLabel>{copy.model}</FieldLabel>
          <ModelPicker label={copy.model} placeholder={copy.modelPlaceholder} models={discoveredModels} value={draft.model} onChange={(model) => setDraft((current) => ({ ...current, model }))} />
        </label>
      ) : null}
      {saveError ? <p role="alert" className="text-sm text-risk">{saveError}</p> : null}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" disabled={testState.kind !== "connected" || !draft.model.trim() || isSaving} onClick={() => void save()}>{isSaving ? copy.saving : copy.save}</PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>{copy.cancel}</SecondaryButton>
      </div>
    </div>
  );
}

function BaseUrlField({ preset, copy, value, isRequired, onChange }: {
  preset: AiProviderPreset;
  copy: AiProvidersCopy;
  value: string;
  isRequired: boolean;
  onChange: (baseUrl: string) => void;
}): React.ReactElement {
  const input = <TextInput aria-label={copy.baseUrl} inputMode="url" placeholder={preset.defaultBaseUrl || "https://…/v1"} value={value} onChange={(event) => onChange(event.target.value)} />;
  const hint = <p className="text-xs text-muted">{isRequired ? copy.customHint : copy.localHint}</p>;
  if (isRequired) {
    return <label className="grid gap-1.5"><FieldLabel>{copy.baseUrl}</FieldLabel>{input}{hint}</label>;
  }
  return (
    <details className="text-sm" open={preset.isLocal}>
      <summary className="cursor-pointer text-muted">{copy.advanced} · <span className="font-mono text-xs">{value || preset.defaultBaseUrl}</span></summary>
      <div className="mt-2 grid gap-1.5">{input}{preset.isLocal ? hint : null}</div>
    </details>
  );
}

function TestStatus({ state, copy }: { state: TestState; copy: AiProvidersCopy }): React.ReactElement | null {
  if (state.kind === "failed") return <p role="alert" className="text-sm text-risk">{state.message}</p>;
  if (state.kind !== "connected") return null;
  const message = state.models.length
    ? copy.connected.replace("{ms}", String(state.latencyMs)).replace("{count}", String(state.models.length))
    : copy.noModels;
  return <p role="status" className="text-sm text-good">{message}</p>;
}
