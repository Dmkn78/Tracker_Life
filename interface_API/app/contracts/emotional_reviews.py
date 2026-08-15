"""Weekly emotional-review request contracts."""

from __future__ import annotations

import re
from datetime import date

from pydantic import Field, field_validator

from .common import ApiRequest

WEEK_ID_PATTERN = re.compile(r"^(\d{4})-W(\d{2})$")


def validate_iso_week_id(value: str) -> str:
    match = WEEK_ID_PATTERN.fullmatch(value)
    if match is None:
        raise ValueError("weekId must use ISO format YYYY-Www")
    year, week = int(match.group(1)), int(match.group(2))
    date.fromisocalendar(year, week, 1)
    return value


class EmotionInput(ApiRequest):
    name: str = Field(min_length=1, max_length=80)
    intensity: int = Field(ge=1, le=5)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return value.strip()


class EmotionalReviewUpsertRequest(ApiRequest):
    week_id: str
    emotions: list[EmotionInput] = Field(default_factory=list, max_length=12)
    factors: list[str] = Field(default_factory=list, max_length=30)
    stress_level: int = Field(default=0, ge=0, le=100)
    triggers: list[str] = Field(default_factory=list, max_length=30)
    mental_signals: list[str] = Field(default_factory=list, max_length=30)
    physical_signals: list[str] = Field(default_factory=list, max_length=30)
    what_helped: list[str] = Field(default_factory=list, max_length=30)
    next_week_action: str | None = Field(default=None, max_length=2_000)
    notes: str | None = Field(default=None, max_length=10_000)

    @field_validator("week_id")
    @classmethod
    def validate_week_id(cls, value: str) -> str:
        return validate_iso_week_id(value)

    @field_validator("factors", "triggers", "mental_signals", "physical_signals", "what_helped")
    @classmethod
    def clean_list(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            item = value.strip()
            if item and item not in cleaned:
                cleaned.append(item)
        return cleaned
