"""OpenAI Chat Completions protocol: OpenAI, OpenRouter, LM Studio and compatible servers."""

from __future__ import annotations

from ..connection import ProviderConnection, StructuredPrompt
from ..errors import AiProviderError
from ..http_transport import ProviderHttpRequest, request_provider_json
from ..structured_output import INVALID_MODEL_OUTPUT_MESSAGE, build_portable_schema, decode_model_json
from .model_list import collect_model_identifiers, require_list


async def list_models(connection: ProviderConnection) -> list[str]:
    response = await request_provider_json(ProviderHttpRequest(f"{connection.base_url}/models", _headers(connection)))
    rows = require_list(response.get("data"))
    model_identifiers = collect_model_identifiers([row.get("id") if isinstance(row, dict) else None for row in rows])
    return model_identifiers


async def generate_json(connection: ProviderConnection, prompt: StructuredPrompt) -> dict:
    payload = {
        "model": connection.model,
        "messages": [
            {"role": "system", "content": prompt.system},
            {"role": "user", "content": prompt.user},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": prompt.schema_name, "strict": True, "schema": build_portable_schema(prompt.json_schema)},
        },
        "temperature": prompt.temperature,
        "max_tokens": prompt.max_tokens,
        "stream": False,
    }
    response = await request_provider_json(ProviderHttpRequest(f"{connection.base_url}/chat/completions", _headers(connection), payload, connection.generation_timeout_seconds))
    generated_object = decode_model_json(_read_message_content(response))
    return generated_object


def _read_message_content(response: dict) -> object:
    try:
        choice = response["choices"][0]
        message = choice["message"]
    except (KeyError, IndexError, TypeError) as error:
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE) from error
    is_complete_text = (
        choice.get("finish_reason") == "stop"
        and not message.get("tool_calls")
        and not message.get("function_call")
        and not message.get("refusal")
    )
    if not is_complete_text:
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE)
    return message.get("content")


def _headers(connection: ProviderConnection) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {connection.api_key}"} if connection.api_key else {}
    return headers
