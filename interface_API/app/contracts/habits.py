"""Habit request contracts."""

from __future__ import annotations

from datetime import date as Date
from typing import Literal

from pydantic import Field, model_validator

from .common import ApiRequest


class HabitCreateRequest(ApiRequest):
    name: str = "New habit"
    category: str = "routine"
    description: str | None = None
    target_time: str | None = None
    default_expected_minutes: int = Field(default=0, ge=0, le=1_440)
    sort_order: int = 99


class HabitUpdateRequest(ApiRequest):
    kind: Literal["checkin"] | None = None
    id: str | None = None
    habit_id: str | None = None
    date: Date | None = None
    status: str | None = None
    actual_minutes: int | None = Field(default=None, ge=0, le=1_440)
    note: str | None = None
    name: str | None = None
    category: str | None = None
    description: str | None = None
    target_time: str | None = None
    default_expected_minutes: int | None = Field(default=None, ge=0, le=1_440)
    sort_order: int | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def validate_target(self):
        if self.kind == "checkin" and not self.habit_id:
            raise ValueError("habitId is required for a check-in")
        if self.kind is None and not self.id:
            raise ValueError("id is required for a habit update")
        return self
