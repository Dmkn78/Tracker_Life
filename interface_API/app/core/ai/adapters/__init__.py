"""One adapter per wire protocol; each exposes `list_models` and `generate_json`."""

from __future__ import annotations

from typing import Protocol

from ..connection import ProviderConnection, StructuredPrompt
from ..provider_presets import ApiProtocol
from . import anthropic_adapter, gemini_adapter, ollama_adapter, openai_adapter


class ProviderAdapter(Protocol):
    async def list_models(self, connection: ProviderConnection) -> list[str]: ...

    async def generate_json(self, connection: ProviderConnection, prompt: StructuredPrompt) -> dict: ...


ADAPTERS_BY_PROTOCOL: dict[ApiProtocol, ProviderAdapter] = {
    "openai": openai_adapter,
    "anthropic": anthropic_adapter,
    "gemini": gemini_adapter,
    "ollama": ollama_adapter,
}
