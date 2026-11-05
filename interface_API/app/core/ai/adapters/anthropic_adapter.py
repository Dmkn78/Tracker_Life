"""Anthropic Messages API. Structured output is obtained by forcing a single tool call."""

from __future__ import annotations

from ..connection import ProviderConnection, StructuredPrompt
from ..errors import AiProviderError
from ..http_transport import ProviderHttpRequest, request_provider_json
from ..structured_output import INVALID_MODEL_OUTPUT_MESSAGE, build_portable_schema
from .model_list import collect_model_identifiers, require_list

ANTHROPIC_API_VERSION = "2023-06-01"
MODEL_PAGE_SIZE = 1000


async def list_models(connection: ProviderConnection) -> list[str]:
    url = f"{connection.base_url}/v1/models?limit={MODEL_PAGE_SIZE}"
    response = await request_provider_json(ProviderHttpRequest(url, _headers(connection)))
    rows = require_list(response.get("data"))
    model_identifiers = collect_model_identifiers([row.get("id") if isinstance(row, dict) else None for row in rows])
    return model_identifiers


async def generate_json(connection: ProviderConnection, prompt: StructuredPrompt) -> dict:
    payload = {
        "model": connection.model,
        "max_tokens": prompt.max_tokens,
        "temperature": prompt.temperature,
        "system": prompt.system,
        "messages": [{"role": "user", "content": prompt.user}],
        "tools": [{
            "name": prompt.schema_name,
            "description": "Return the complete answer as this tool's input.",
            "input_schema": build_portable_schema(prompt.json_schema),
        }],
        "tool_choice": {"type": "tool", "name": prompt.schema_name},
    }
    response = await request_provider_json(ProviderHttpRequest(f"{connection.base_url}/v1/messages", _headers(connection), payload, connection.generation_timeout_seconds))
    generated_object = _read_tool_input(response, prompt.schema_name)
    return generated_object


def _read_tool_input(response: dict, tool_name: str) -> dict:
    blocks = response.get("content")
    if not isinstance(blocks, list):
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE)
    for block in blocks:
        if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("name") == tool_name:
            tool_input = block.get("input")
            if isinstance(tool_input, dict):
                return tool_input
    raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE)


def _headers(connection: ProviderConnection) -> dict[str, str]:
    headers = {"anthropic-version": ANTHROPIC_API_VERSION}
    if connection.api_key:
        headers["x-api-key"] = connection.api_key
    return headers
