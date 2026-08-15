"""Habit request contracts."""

from __future__ import annotations

from datetime import date as Date
from typing import Literal
import re

from pydantic import Field, field_validator, model_validator


def validate_recurrence_days(days: list[int]) -> list[int]:
    normalized = sorted(set(days))
    if not normalized or any(day < 1 or day > 7 for day in normalized):
        raise ValueError("recurrenceDays must contain one or more ISO weekdays from 1 to 7")
    return normalized


def validate_target_time(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
        raise ValueError("targetTime must use 24-hour HH:MM format")
    return value

from .common import ApiRequest


class HabitCreateRequest(ApiRequest):
    kind: Literal["habit", "template"] = "habit"
    name: str = "New habit"
    category: str = "routine"
    description: str | None = None
    target_time: str | None = None
    default_expected_minutes: int = Field(default=0, ge=0, le=1_440)
    recurrence_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5, 6, 7])
    time_block_enabled: bool = False
    save_as_template: bool = False
    sort_order: int = 99

    @field_validator("recurrence_days")
    @classmethod
    def validate_days(cls, days: list[int]) -> list[int]:
        return validate_recurrence_days(days)

    @field_validator("target_time")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        return validate_target_time(value)

    @model_validator(mode="after")
    def validate_time_block(self):
        if self.time_block_enabled and (not self.target_time or self.default_expected_minutes <= 0):
            raise ValueError("time blocking requires targetTime and a positive expected duration")
        return self


class HabitUpdateRequest(ApiRequest):
    kind: Literal["checkin"] | None = None
    id: str | None = None
    habit_id: str | None = None
    date: Date | None = None
    status: Literal["planned", "done", "skipped"] | None = None
    actual_minutes: int | None = Field(default=None, ge=0, le=1_440)
    note: str | None = None
    name: str | None = None
    category: str | None = None
    description: str | None = None
    target_time: str | None = None
    default_expected_minutes: int | None = Field(default=None, ge=0, le=1_440)
    recurrence_days: list[int] | None = None
    time_block_enabled: bool | None = None
    sort_order: int | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def validate_target(self):
        if self.kind == "checkin" and not self.habit_id:
            raise ValueError("habitId is required for a check-in")
        if self.kind is None and not self.id:
            raise ValueError("id is required for a habit update")
        return self

    @field_validator("recurrence_days")
    @classmethod
    def validate_days(cls, days: list[int] | None) -> list[int] | None:
        return validate_recurrence_days(days) if days is not None else None

    @field_validator("target_time")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        return validate_target_time(value)
