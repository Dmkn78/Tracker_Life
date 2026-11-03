"""Shared validation of model identifiers returned by any provider."""

from __future__ import annotations

from ..errors import AiProviderError

MAX_MODELS = 1000
MAX_MODEL_IDENTIFIER_LENGTH = 300


def collect_model_identifiers(raw_identifiers: list[object]) -> list[str]:
    if len(raw_identifiers) > MAX_MODELS:
        raise AiProviderError(502, "Le fournisseur a renvoyé une liste de modèles trop longue.")
    model_identifiers: list[str] = []
    for identifier in raw_identifiers:
        if not isinstance(identifier, str) or not identifier.strip() or len(identifier) > MAX_MODEL_IDENTIFIER_LENGTH:
            raise AiProviderError(502, "Le fournisseur a renvoyé une liste de modèles invalide.")
        if identifier not in model_identifiers:
            model_identifiers.append(identifier)
    return model_identifiers


def require_list(value: object) -> list[object]:
    if not isinstance(value, list):
        raise AiProviderError(502, "Le fournisseur a renvoyé une liste de modèles invalide.")
    return value
