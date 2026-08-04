"""Tag request contracts."""

from __future__ import annotations

from pydantic import Field

from .common import ApiRequest


class TagCreateRequest(ApiRequest):
    name: str = Field(min_length=1)
    color: str | None = None


class TagUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    name: str | None = None
    color: str | None = None
