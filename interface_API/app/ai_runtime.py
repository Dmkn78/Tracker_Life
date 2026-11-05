"""Reads the AI-related server settings once, for routers that call a provider."""

from __future__ import annotations

from .config import get_settings
from .core.ai_provider_store import ProviderRuntime


def current_provider_runtime() -> ProviderRuntime:
    settings = get_settings()
    runtime = ProviderRuntime(key_secret=settings.provider_key_secret, generation_timeout_seconds=settings.ai_generation_timeout_seconds)
    return runtime
