"""Runtime description of one provider connection, independent of storage."""

from __future__ import annotations

from dataclasses import dataclass, field

from .provider_presets import ApiProtocol


@dataclass(frozen=True)
class ProviderConnection:
    protocol: ApiProtocol
    base_url: str
    model: str
    api_key: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class StructuredPrompt:
    """A request whose answer must be one JSON object matching `json_schema`."""

    system: str
    user: str
    schema_name: str
    json_schema: dict
    max_tokens: int = 4096
    temperature: float = 0.2
