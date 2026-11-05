"""Google Gemini (Generative Language API v1beta) with JSON-schema constrained output."""

from __future__ import annotations

from urllib.parse import quote

from ..connection import ProviderConnection, StructuredPrompt
from ..errors import AiProviderError
from ..http_transport import ProviderHttpRequest, request_provider_json
from ..structured_output import INVALID_MODEL_OUTPUT_MESSAGE, build_portable_schema, decode_model_json
from .model_list import collect_model_identifiers, require_list

MODEL_PAGE_SIZE = 1000
GENERATE_METHOD = "generateContent"


async def list_models(connection: ProviderConnection) -> list[str]:
    url = f"{connection.base_url}/v1beta/models?pageSize={MODEL_PAGE_SIZE}"
    response = await request_provider_json(ProviderHttpRequest(url, _headers(connection)))
    rows = require_list(response.get("models"))
    generative_names = [
        row.get("name", "").removeprefix("models/") if isinstance(row.get("name"), str) else None
        for row in rows
        if isinstance(row, dict) and GENERATE_METHOD in (row.get("supportedGenerationMethods") or [])
    ]
    model_identifiers = collect_model_identifiers(generative_names)
    return model_identifiers


async def generate_json(connection: ProviderConnection, prompt: StructuredPrompt) -> dict:
    payload = {
        "systemInstruction": {"parts": [{"text": prompt.system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt.user}]}],
        "generationConfig": {
            "temperature": prompt.temperature,
            "maxOutputTokens": prompt.max_tokens,
            "responseMimeType": "application/json",
            "responseJsonSchema": build_portable_schema(prompt.json_schema),
        },
    }
    url = f"{connection.base_url}/v1beta/models/{quote(connection.model, safe='')}:{GENERATE_METHOD}"
    response = await request_provider_json(ProviderHttpRequest(url, _headers(connection), payload))
    generated_object = decode_model_json(_read_candidate_text(response))
    return generated_object


def _read_candidate_text(response: dict) -> str:
    try:
        candidate = response["candidates"][0]
        parts = candidate["content"]["parts"]
    except (KeyError, IndexError, TypeError) as error:
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE) from error
    if candidate.get("finishReason") not in {None, "STOP"}:
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE)
    candidate_text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    return candidate_text


def _headers(connection: ProviderConnection) -> dict[str, str]:
    headers = {"x-goog-api-key": connection.api_key} if connection.api_key else {}
    return headers
