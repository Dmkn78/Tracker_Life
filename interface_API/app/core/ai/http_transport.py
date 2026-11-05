"""Bounded JSON HTTP calls to AI providers with timeouts and user-facing error mapping."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import httpx

from .connection import DEFAULT_GENERATION_TIMEOUT_SECONDS
from .endpoint_policy import ensure_resolved_host_allowed
from .errors import AiProviderError

MAX_PROVIDER_RESPONSE_BYTES = 1_048_576
DISCOVERY_TIMEOUT_SECONDS = 15
CONNECT_TIMEOUT_SECONDS = 5


@dataclass(frozen=True)
class ProviderHttpRequest:
    url: str
    headers: dict[str, str] = field(repr=False)
    payload: dict | None = None
    generation_timeout_seconds: int = DEFAULT_GENERATION_TIMEOUT_SECONDS

    @property
    def method(self) -> str:
        return "GET" if self.payload is None else "POST"

    @property
    def is_generation(self) -> bool:
        return self.payload is not None

    @property
    def timeout_seconds(self) -> int:
        return self.generation_timeout_seconds if self.is_generation else DISCOVERY_TIMEOUT_SECONDS


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
    except httpx.ConnectTimeout as error:
        raise AiProviderError(503, _unreachable_message(request)) from error
    except (httpx.TimeoutException, TimeoutError) as error:
        raise AiProviderError(504, _too_slow_message(request)) from error
    except httpx.RequestError as error:
        raise AiProviderError(503, "Fournisseur inaccessible depuis le serveur API. Vérifiez l'adresse et que le service est démarré.") from error
    except (ValueError, UnicodeError) as error:
        raise AiProviderError(502, "Le fournisseur a renvoyé une réponse JSON invalide.") from error


def _unreachable_message(request: ProviderHttpRequest) -> str:
    """The TCP connection itself never opened: an address/network problem, not a slow model."""
    host = urlsplit(request.url).hostname or "le serveur"
    unreachable_message = (
        f"Impossible de joindre {host} : la connexion n'a pas abouti en {CONNECT_TIMEOUT_SECONDS} s. "
        "Vérifiez l'adresse et le port, que le serveur du modèle accepte les connexions réseau "
        "(LM Studio : « Serve on Local Network » ; Ollama : OLLAMA_HOST=0.0.0.0) et qu'aucun pare-feu ne bloque ce port."
    )
    return unreachable_message


def _too_slow_message(request: ProviderHttpRequest) -> str:
    if not request.is_generation:
        return f"Le serveur est joignable mais n'a pas renvoyé la liste des modèles en {DISCOVERY_TIMEOUT_SECONDS} s."
    too_slow_message = (
        f"Le modèle est joignable mais n'a pas terminé sa réponse en {request.timeout_seconds} s. "
        "Vérifiez qu'il est bien chargé (le premier appel peut le charger en mémoire), choisissez un modèle plus léger, "
        "ou augmentez AI_GENERATION_TIMEOUT_SECONDS sur le serveur API."
    )
    return too_slow_message


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
