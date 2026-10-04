"""Strict contracts for the local assistant's read-only proposals."""

from __future__ import annotations

from datetime import date as Date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


AssistantMode = Literal["tasks", "day", "week"]
MAX_PROPOSED_TASKS = 20


class AssistantContract(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid", strict=True)


class ProviderSettings(AssistantContract):
    base_url: str = Field(min_length=1, max_length=500)
    model: str = Field(max_length=300)
    api_key: str | None = Field(default=None, max_length=2000, repr=False)

    @field_validator("base_url", "model", "api_key")
    @classmethod
    def reject_control_characters(cls, text: str | None) -> str | None:
        if text is not None and any(ord(character) < 32 or ord(character) == 127 for character in text):
            raise ValueError("Control characters are not allowed")
        return text.strip() if text is not None else None


class AssistantModelsRequest(AssistantContract):
    provider: ProviderSettings


class AssistantPreviewRequest(AssistantContract):
    provider: ProviderSettings
    prompt: str = Field(max_length=8000)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    mode: AssistantMode

    @field_validator("date")
    @classmethod
    def validate_date(cls, date_key: str) -> str:
        Date.fromisoformat(date_key)
        return date_key

    @model_validator(mode="after")
    def require_generation_input(self) -> AssistantPreviewRequest:
        if not self.provider.model:
            raise ValueError("Select a model before generating a proposal")
        if self.mode == "tasks" and not self.prompt.strip():
            raise ValueError("Describe the tasks to propose")
        return self


class ProposedTask(AssistantContract):
    title: str = Field(min_length=1, max_length=240)
    description: str | None = Field(max_length=3000)
    date: str | None = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str | None = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end_time: str | None = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    estimated_minutes: int = Field(ge=0, le=10_080)
    importance: Literal["low", "medium", "high"]
    productive: bool

    @field_validator("title")
    @classmethod
    def require_title(cls, title: str) -> str:
        if not title.strip():
            raise ValueError("A task title cannot be blank")
        return title.strip()

    @field_validator("date")
    @classmethod
    def validate_date(cls, date_key: str | None) -> str | None:
        if date_key is not None:
            Date.fromisoformat(date_key)
        return date_key

    @model_validator(mode="after")
    def validate_schedule(self) -> ProposedTask:
        if self.end_time is not None and self.start_time is None:
            raise ValueError("An end time needs a start time")
        if self.start_time is not None and self.date is None:
            raise ValueError("A scheduled task needs a date")
        if self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("The end time must be after the start")
        return self


class GeneratedPreview(AssistantContract):
    analysis: str = Field(max_length=12000)
    tasks: list[ProposedTask] = Field(max_length=MAX_PROPOSED_TASKS)


class AssistantPreviewResponse(GeneratedPreview):
    from_date: str = Field(alias="from")
    to: str


class AssistantModelsResponse(AssistantContract):
    models: list[str]
