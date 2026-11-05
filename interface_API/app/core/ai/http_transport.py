"""Bounded JSON HTTP calls to AI providers with timeouts and user-facing error mapping."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field

import httpx

from .endpoint_policy import ensure_resolved_host_allowed
from .errors import AiProviderError

MAX_PROVIDER_RESPONSE_BYTES = 1_048_576
GENERATION_TIMEOUT_SECONDS = 120
DISCOVERY_TIMEOUT_SECONDS = 15
CONNECT_TIMEOUT_SECONDS = 5


@dataclass(frozen=True)
class ProviderHttpRequest:
    url: str
    headers: dict[str, str] = field(repr=False)
    payload: dict | None = None

    @property
    def method(self) -> str:
        return "GET" if self.payload is None else "POST"

    @property
    def timeout_seconds(self) -> int:
        return DISCOVERY_TIMEOUT_SECONDS if self.payload is None else GENERATION_TIMEOUT_SECONDS


async def request_provider_json(request: ProviderHttpRequest) -> dict:
    """Send one request; never follows redirects nor reads proxy settings from the environment."""
    await asyncio.to_thread(ensure_resolved_host_allowed, request.url)
    timeout = httpx.Timeout(request.timeout_seconds, connect=CONNECT_TIMEOUT_SECONDS)
    try:
        async with asyncio.timeout(request.timeout_seconds):
            async with httpx.AsyncClient(timeout=timeout, trust_env=False, follow_redirects=False) as client:
                headers = {"Accept": "application/json", **request.headers}
                async with client.stream(request.method, request.url, headers=headers, json=request.payload) as response:
                    _raise_for_status(response.status_code)
                    body = await _read_bounded_body(response)
        decoded = json.loads(body)
        if not isinstance(decoded, dict):
            raise ValueError("Provider response is not a JSON object")
        return decoded
    except (httpx.TimeoutException, TimeoutError) as error:
        raise AiProviderError(504, "Le modèle met trop de temps à répondre. Vérifiez qu'il est chargé puis réessayez.") from error
    except httpx.RequestError as error:
        raise AiProviderError(503, "Fournisseur inaccessible depuis le serveur API. Vérifiez l'adresse et que le service est démarré.") from error
    except (ValueError, UnicodeError) as error:
        raise AiProviderError(502, "Le fournisseur a renvoyé une réponse JSON invalide.") from error


def _raise_for_status(status_code: int) -> None:
    if status_code in {401, 403}:
        raise AiProviderError(502, "Le fournisseur a refusé l'authentification. Vérifiez la clé API.")
    if status_code == 404:
        raise AiProviderError(502, "Point d'accès introuvable. Vérifiez l'adresse du serveur et le modèle choisi.")
    if status_code == 429:
        raise AiProviderError(429, "Le fournisseur limite les requêtes (quota ou débit). Réessayez plus tard.")
    if status_code >= 300:
        raise AiProviderError(502, f"Le fournisseur a refusé la requête (HTTP {status_code}). Vérifiez le modèle et ses capacités.")


async def _read_bounded_body(response: httpx.Response) -> bytes:
    body = bytearray()
    async for chunk in response.aiter_bytes():
        body.extend(chunk)
        if len(body) > MAX_PROVIDER_RESPONSE_BYTES:
            raise AiProviderError(502, "La réponse du fournisseur dépasse la taille autorisée.")
    return bytes(body)
