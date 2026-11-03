"""Requests of the knowledge base (second brain)."""

from __future__ import annotations

from pydantic import Field, field_validator

from .common import ApiRequest

MAX_CAPTURE_LENGTH = 50_000


class NoteCaptureRequest(ApiRequest):
    text: str = Field(min_length=1, max_length=MAX_CAPTURE_LENGTH)

    @field_validator("text")
    @classmethod
    def require_content(cls, text: str) -> str:
        if not text.strip():
            raise ValueError("A note cannot be blank")
        return text
