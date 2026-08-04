"""Thinking note request contracts."""

from __future__ import annotations

from datetime import datetime as DateTime

from pydantic import Field

from .common import ApiRequest


class ThinkingNoteCreateRequest(ApiRequest):
    title: str | None = None
    content: str = Field(min_length=1)
    reminder_at: DateTime | None = None
    tag_ids: list[str] = Field(default_factory=list)
    tag_names: list[str] = Field(default_factory=list)
    task_ids: list[str] = Field(default_factory=list)


class ThinkingNoteUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    title: str | None = None
    content: str | None = None
    reminder_at: DateTime | None = None
    tag_ids: list[str] | None = None
    tag_names: list[str] | None = None
    task_ids: list[str] | None = None
