"""Persistence of provider configurations and resolution of the connection to use."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AiProvider
from .ai.api_key_cipher import decrypt_api_key
from .ai.connection import ProviderConnection
from .ai.errors import AiProviderError
from .ai.provider_presets import get_provider_preset

@dataclass(frozen=True)
class ProviderRuntime:
    """Server-side settings applied to every provider call."""

    key_secret: str
    generation_timeout_seconds: int


NO_PROVIDER_MESSAGE = "Aucun modèle d'IA n'est configuré. Ajoutez-en un dans Réglages → Modèles d'IA."


def serialize_provider(provider: AiProvider) -> dict:
    preset = get_provider_preset(provider.kind)
    serialized_provider = {
        "id": provider.id,
        "kind": provider.kind,
        "label": provider.label,
        "baseUrl": provider.baseUrl,
        "model": provider.model,
        "hasApiKey": provider.encryptedApiKey is not None,
        "apiKeyHint": provider.apiKeyHint,
        "isDefault": provider.isDefault,
        "isLocal": preset.is_local,
    }
    return serialized_provider


def list_user_providers(db: Session, user_id: str) -> list[AiProvider]:
    providers = list(db.scalars(
        select(AiProvider).where(AiProvider.userId == user_id).order_by(AiProvider.isDefault.desc(), AiProvider.createdAt.asc())
    ))
    return providers


def load_owned_provider(db: Session, user_id: str, provider_id: str) -> AiProvider:
    provider = db.scalar(select(AiProvider).where(AiProvider.id == provider_id, AiProvider.userId == user_id))
    if provider is None:
        raise AiProviderError(404, "Fournisseur introuvable.")
    return provider


def make_default_provider(db: Session, user_id: str, provider: AiProvider) -> None:
    for other_provider in list_user_providers(db, user_id):
        other_provider.isDefault = other_provider.id == provider.id


def build_provider_connection(provider: AiProvider, runtime: ProviderRuntime) -> ProviderConnection:
    api_key = decrypt_api_key(runtime.key_secret, provider.encryptedApiKey) if provider.encryptedApiKey else None
    preset = get_provider_preset(provider.kind)
    connection = ProviderConnection(
        protocol=preset.protocol,
        base_url=provider.baseUrl,
        model=provider.model,
        api_key=api_key,
        is_local=preset.is_local,
        generation_timeout_seconds=runtime.generation_timeout_seconds,
    )
    return connection


def resolve_active_connection(db: Session, user_id: str, runtime: ProviderRuntime, provider_id: str | None = None) -> ProviderConnection:
    """Use the requested provider, otherwise the default one, otherwise explain how to configure one."""
    if provider_id:
        provider = load_owned_provider(db, user_id, provider_id)
    else:
        providers = list_user_providers(db, user_id)
        if not providers:
            raise AiProviderError(409, NO_PROVIDER_MESSAGE)
        provider = providers[0]
    connection = build_provider_connection(provider, runtime)
    return connection
