"use client";

import { KeyRound, LoaderCircle, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { GhostButton, Pill, SecondaryButton } from "@/components/ui";
import { testSavedConnection } from "../api/aiProvidersApi";
import type { AiProvider } from "../domain/aiProvider";
import type { AiProvidersCopy } from "./aiProvidersCopy";
import { ModelPicker } from "./ModelPicker";

type RowTest = { kind: "idle" } | { kind: "testing" } | { kind: "connected"; models: string[] } | { kind: "failed"; message: string };

export function AiProviderRow({ provider, copy, onModelChange, onMakeDefault, onRemove }: {
  provider: AiProvider;
  copy: AiProvidersCopy;
  onModelChange: (model: string) => void;
  onMakeDefault: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const [rowTest, setRowTest] = useState<RowTest>({ kind: "idle" });

  async function testConnection(): Promise<void> {
    setRowTest({ kind: "testing" });
    try {
      const result = await testSavedConnection(provider.id);
      setRowTest({ kind: "connected", models: result.models });
    } catch (error: unknown) {
      setRowTest({ kind: "failed", message: error instanceof Error ? error.message : copy.failed });
    }
  }

  return (
    <li className="grid gap-3 rounded-[20px] bg-panel2/50 p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{provider.label}</p>
          <p className="break-all text-sm text-muted">{provider.model || copy.noModel}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {provider.isDefault ? <Pill className="text-good">{copy.isDefault}</Pill> : null}
            <Pill>{provider.isLocal ? copy.local : copy.cloud}</Pill>
            {provider.hasApiKey ? <Pill><KeyRound className="mr-1 inline h-3 w-3" />{provider.apiKeyHint}</Pill> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={() => void testConnection()} disabled={rowTest.kind === "testing"}>
            {rowTest.kind === "testing" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{copy.retest}
          </SecondaryButton>
          {!provider.isDefault ? <SecondaryButton type="button" onClick={onMakeDefault}><Star className="h-4 w-4" />{copy.makeDefault}</SecondaryButton> : null}
          <GhostButton type="button" aria-label={copy.remove} onClick={onRemove} className="text-risk"><Trash2 className="h-4 w-4" /></GhostButton>
        </div>
      </div>
      {rowTest.kind === "failed" ? <p role="alert" className="text-sm text-risk">{rowTest.message}</p> : null}
      {rowTest.kind === "connected" ? (
        <ModelPicker label={copy.model} placeholder={copy.modelPlaceholder} models={rowTest.models} value={provider.model} onChange={onModelChange} />
      ) : null}
    </li>
  );
}
