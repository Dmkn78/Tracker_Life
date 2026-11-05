"""Ollama native API (/api/tags, /api/chat) with a JSON schema passed as `format`."""

from __future__ import annotations

from ..connection import ProviderConnection, StructuredPrompt
from ..errors import AiProviderError
from ..http_transport import ProviderHttpRequest, request_provider_json
from ..structured_output import INVALID_MODEL_OUTPUT_MESSAGE, build_portable_schema, decode_model_json
from .model_list import collect_model_identifiers, require_list


async def list_models(connection: ProviderConnection) -> list[str]:
    response = await request_provider_json(ProviderHttpRequest(f"{connection.base_url}/api/tags", _headers(connection)))
    rows = require_list(response.get("models"))
    model_identifiers = collect_model_identifiers([row.get("name") if isinstance(row, dict) else None for row in rows])
    return model_identifiers


async def generate_json(connection: ProviderConnection, prompt: StructuredPrompt) -> dict:
    payload = {
        "model": connection.model,
        "messages": [
            {"role": "system", "content": prompt.system},
            {"role": "user", "content": prompt.user},
        ],
        "format": build_portable_schema(prompt.json_schema),
        "stream": False,
        "options": {"temperature": prompt.temperature, "num_predict": prompt.max_tokens},
    }
    response = await request_provider_json(ProviderHttpRequest(f"{connection.base_url}/api/chat", _headers(connection), payload, connection.generation_timeout_seconds))
    message = response.get("message")
    if not isinstance(message, dict) or response.get("done") is False:
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE)
    generated_object = decode_model_json(message.get("content"))
    return generated_object


def _headers(connection: ProviderConnection) -> dict[str, str]:
    # Ollama has no auth by default; a reverse proxy in front of it may require a bearer token.
    headers = {"Authorization": f"Bearer {connection.api_key}"} if connection.api_key else {}
    return headers
