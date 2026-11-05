"""Requests to configure AI providers from Settings."""

from __future__ import annotations

from pydantic import Field, field_validator

from .common import ApiRequest

MAX_URL_LENGTH = 500
MAX_API_KEY_LENGTH = 4000


def _reject_control_characters(text: str | None) -> str | None:
    if text is None:
        return None
    if any(ord(character) < 32 or ord(character) == 127 for character in text):
        raise ValueError("Control characters are not allowed")
    return text.strip()


class AiProviderCreateRequest(ApiRequest):
    kind: str = Field(min_length=1, max_length=40)
    label: str | None = Field(default=None, max_length=80)
    base_url: str | None = Field(default=None, max_length=MAX_URL_LENGTH)
    model: str = Field(default="", max_length=300)
    api_key: str | None = Field(default=None, max_length=MAX_API_KEY_LENGTH, repr=False)

    _clean = field_validator("label", "base_url", "model", "api_key")(_reject_control_characters)


class AiProviderUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    label: str | None = Field(default=None, max_length=80)
    base_url: str | None = Field(default=None, max_length=MAX_URL_LENGTH)
    model: str | None = Field(default=None, max_length=300)
    # An empty string removes the stored key; an absent field keeps it.
    api_key: str | None = Field(default=None, max_length=MAX_API_KEY_LENGTH, repr=False)
    is_default: bool | None = None

    _clean = field_validator("label", "base_url", "model", "api_key")(_reject_control_characters)


class AiProviderTestRequest(ApiRequest):
    """Test a saved provider (`providerId`), a draft, or a saved provider with overridden fields."""

    provider_id: str | None = None
    kind: str | None = Field(default=None, max_length=40)
    base_url: str | None = Field(default=None, max_length=MAX_URL_LENGTH)
    api_key: str | None = Field(default=None, max_length=MAX_API_KEY_LENGTH, repr=False)

    _clean = field_validator("base_url", "api_key")(_reject_control_characters)
