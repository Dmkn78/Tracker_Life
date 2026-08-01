"""Shared conventions for HTTP request models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiRequest(BaseModel):
    """Base request model matching the frontend's camelCase payloads."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )
