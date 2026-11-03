"""Known provider kinds. A preset pre-fills the form so the user only types what is unknown."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .errors import AiProviderError

ProviderKind = Literal["lmstudio", "ollama", "openai", "anthropic", "gemini", "openrouter", "openai_compatible"]
ApiProtocol = Literal["openai", "anthropic", "gemini", "ollama"]


@dataclass(frozen=True)
class ProviderPreset:
    kind: ProviderKind
    label: str
    protocol: ApiProtocol
    default_base_url: str
    requires_api_key: bool
    is_local: bool


PROVIDER_PRESETS: dict[str, ProviderPreset] = {
    preset.kind: preset
    for preset in (
        ProviderPreset("lmstudio", "LM Studio", "openai", "http://127.0.0.1:1234/v1", False, True),
        ProviderPreset("ollama", "Ollama", "ollama", "http://127.0.0.1:11434", False, True),
        ProviderPreset("openai", "OpenAI", "openai", "https://api.openai.com/v1", True, False),
        ProviderPreset("anthropic", "Anthropic", "anthropic", "https://api.anthropic.com", True, False),
        ProviderPreset("gemini", "Google Gemini", "gemini", "https://generativelanguage.googleapis.com", True, False),
        ProviderPreset("openrouter", "OpenRouter", "openai", "https://openrouter.ai/api/v1", True, False),
        ProviderPreset("openai_compatible", "Serveur compatible OpenAI", "openai", "", False, False),
    )
}


def get_provider_preset(kind: str) -> ProviderPreset:
    preset = PROVIDER_PRESETS.get(kind)
    if preset is None:
        raise AiProviderError(400, f"Type de fournisseur inconnu : {kind}.")
    return preset
