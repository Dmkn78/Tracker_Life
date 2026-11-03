"""Settings → AI models: add, test, choose and remove providers. Keys never leave the server."""

from __future__ import annotations

import time
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import get_settings
from ..contracts.ai_providers import AiProviderCreateRequest, AiProviderTestRequest, AiProviderUpdateRequest
from ..core.ai.api_key_cipher import build_api_key_hint, encrypt_api_key
from ..core.ai.connection import ProviderConnection
from ..core.ai.endpoint_policy import normalize_provider_base_url
from ..core.ai.errors import AiProviderError
from ..core.ai.gateway import list_provider_models
from ..core.ai.provider_presets import PROVIDER_PRESETS, get_provider_preset
from ..core.ai_provider_store import (
    build_provider_connection,
    list_user_providers,
    load_owned_provider,
    make_default_provider,
    serialize_provider,
)
from ..database import get_db
from ..models import AiProvider, User
from ..security import get_current_user

router = APIRouter(prefix="/api/ai-providers", tags=["ai-providers"])


@router.get("")
def list_providers(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    providers = [serialize_provider(provider) for provider in list_user_providers(db, user.id)]
    presets = [asdict(preset) for preset in PROVIDER_PRESETS.values()]
    return {"providers": providers, "presets": presets}


@router.post("")
def create_provider(body: AiProviderCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    try:
        preset = get_provider_preset(body.kind)
        base_url = normalize_provider_base_url(body.base_url or preset.default_base_url)
        _require_api_key_when_needed(preset.requires_api_key, body.api_key)
    except AiProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    provider = AiProvider(userId=user.id, kind=preset.kind, label=body.label or preset.label, baseUrl=base_url, model=body.model)
    _store_api_key(provider, body.api_key)
    db.add(provider)
    db.flush()
    if not any(other.isDefault for other in list_user_providers(db, user.id)):
        make_default_provider(db, user.id, provider)
    db.flush()
    return {"provider": serialize_provider(provider)}


@router.patch("")
def update_provider(body: AiProviderUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    try:
        provider = load_owned_provider(db, user.id, body.id)
        provided_fields = body.model_fields_set
        if body.base_url is not None:
            provider.baseUrl = normalize_provider_base_url(body.base_url)
        if "api_key" in provided_fields:
            _require_api_key_when_needed(get_provider_preset(provider.kind).requires_api_key, body.api_key)
            _store_api_key(provider, body.api_key)
    except AiProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    if body.label:
        provider.label = body.label
    if body.model is not None:
        provider.model = body.model
    if body.is_default:
        make_default_provider(db, user.id, provider)
    db.flush()
    return {"provider": serialize_provider(provider)}


@router.delete("")
def delete_provider(id: str = Query(min_length=1), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    try:
        provider = load_owned_provider(db, user.id, id)
    except AiProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    was_default = provider.isDefault
    db.delete(provider)
    db.flush()
    remaining_providers = list_user_providers(db, user.id)
    if was_default and remaining_providers:
        make_default_provider(db, user.id, remaining_providers[0])
    return {"ok": True}


@router.post("/test")
async def test_provider(body: AiProviderTestRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Connect and list models; nothing is saved, so a draft can be tested before creation."""
    try:
        connection = _build_test_connection(body, user.id, db)
        started_at = time.monotonic()
        models = await list_provider_models(connection)
    except AiProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    latency_ms = round((time.monotonic() - started_at) * 1000)
    return {"ok": True, "models": models, "latencyMs": latency_ms}


def _build_test_connection(body: AiProviderTestRequest, user_id: str, db: Session) -> ProviderConnection:
    key_secret = get_settings().provider_key_secret
    if body.provider_id:
        stored = build_provider_connection(load_owned_provider(db, user_id, body.provider_id), key_secret)
        base_url = normalize_provider_base_url(body.base_url) if body.base_url else stored.base_url
        api_key = body.api_key if body.api_key else stored.api_key
        connection = ProviderConnection(stored.protocol, base_url, stored.model, api_key)
        return connection
    preset = get_provider_preset(body.kind or "")
    base_url = normalize_provider_base_url(body.base_url or preset.default_base_url)
    _require_api_key_when_needed(preset.requires_api_key, body.api_key)
    connection = ProviderConnection(preset.protocol, base_url, "", body.api_key or None)
    return connection


def _require_api_key_when_needed(requires_api_key: bool, api_key: str | None) -> None:
    if requires_api_key and not api_key:
        raise AiProviderError(400, "Ce fournisseur exige une clé API.")


def _store_api_key(provider: AiProvider, api_key: str | None) -> None:
    if not api_key:
        provider.encryptedApiKey = None
        provider.apiKeyHint = None
        return
    provider.encryptedApiKey = encrypt_api_key(get_settings().provider_key_secret, api_key)
    provider.apiKeyHint = build_api_key_hint(api_key)
