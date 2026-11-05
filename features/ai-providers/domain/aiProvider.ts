import { expectBoolean, expectJsonObject, expectNullableString, expectString, parseJsonArray } from "@/lib/http/apiClient";

export type AiProviderKind = "lmstudio" | "ollama" | "openai" | "anthropic" | "gemini" | "openrouter" | "openai_compatible";

export type AiProviderPreset = {
  kind: AiProviderKind;
  label: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  isLocal: boolean;
};

export type AiProvider = {
  id: string;
  kind: AiProviderKind;
  label: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  isDefault: boolean;
  isLocal: boolean;
};

export type AiProviderCatalog = { providers: AiProvider[]; presets: AiProviderPreset[] };

export type AiProviderDraft = { kind: AiProviderKind; baseUrl: string; apiKey: string; model: string; label: string };

export type ConnectionTestResult = { models: string[]; latencyMs: number };

const PROVIDER_KINDS: readonly AiProviderKind[] = ["lmstudio", "ollama", "openai", "anthropic", "gemini", "openrouter", "openai_compatible"];

export function parseAiProviderCatalog(payload: unknown): AiProviderCatalog {
  const response = expectJsonObject(payload, "AI providers");
  const catalog: AiProviderCatalog = {
    providers: parseJsonArray(response.providers, "providers", parseAiProvider),
    presets: parseJsonArray(response.presets, "presets", parsePreset)
  };
  return catalog;
}

export function parseAiProvider(payload: unknown, context = "provider"): AiProvider {
  const provider = expectJsonObject(payload, context);
  const parsedProvider: AiProvider = {
    id: expectString(provider.id, `${context}.id`),
    kind: parseKind(provider.kind, `${context}.kind`),
    label: expectString(provider.label, `${context}.label`),
    baseUrl: expectString(provider.baseUrl, `${context}.baseUrl`),
    model: expectString(provider.model, `${context}.model`),
    hasApiKey: expectBoolean(provider.hasApiKey, `${context}.hasApiKey`),
    apiKeyHint: expectNullableString(provider.apiKeyHint, `${context}.apiKeyHint`),
    isDefault: expectBoolean(provider.isDefault, `${context}.isDefault`),
    isLocal: expectBoolean(provider.isLocal, `${context}.isLocal`)
  };
  return parsedProvider;
}

export function findDefaultProvider(providers: AiProvider[]): AiProvider | null {
  const defaultProvider = providers.find((provider) => provider.isDefault) ?? providers[0] ?? null;
  return defaultProvider;
}

export function isDraftReadyToTest(draft: AiProviderDraft, preset: AiProviderPreset): boolean {
  const hasBaseUrl = Boolean(draft.baseUrl.trim() || preset.defaultBaseUrl);
  const hasRequiredKey = !preset.requiresApiKey || Boolean(draft.apiKey.trim());
  return hasBaseUrl && hasRequiredKey;
}

function parsePreset(payload: unknown, context: string): AiProviderPreset {
  const preset = expectJsonObject(payload, context);
  const parsedPreset: AiProviderPreset = {
    kind: parseKind(preset.kind, `${context}.kind`),
    label: expectString(preset.label, `${context}.label`),
    defaultBaseUrl: expectString(preset.defaultBaseUrl, `${context}.defaultBaseUrl`),
    requiresApiKey: expectBoolean(preset.requiresApiKey, `${context}.requiresApiKey`),
    isLocal: expectBoolean(preset.isLocal, `${context}.isLocal`)
  };
  return parsedPreset;
}

function parseKind(value: unknown, field: string): AiProviderKind {
  const kind = expectString(value, field);
  if (!PROVIDER_KINDS.includes(kind as AiProviderKind)) throw new Error(`${field} is not a known provider kind`);
  return kind as AiProviderKind;
}
