"""Objective and weekly-planning request contracts."""

from __future__ import annotations

from datetime import date as Date
from typing import Literal

from pydantic import Field, model_validator

from .common import ApiRequest
from .enums import (
    ObjectiveHorizon,
    ObjectiveKind,
    ObjectivePriority,
    ObjectiveStatus,
    WeeklyPlanCategory,
)

ObjectiveCommandKind = Literal["weekly_block", "bootstrap_demo"]


class ObjectiveCreateRequest(ApiRequest):
    kind: ObjectiveKind | ObjectiveCommandKind = ObjectiveKind.OBJECTIVE
    week_id: str | None = None
    objective_id: str | None = None
    parent_id: str | None = None
    title: str | None = None
    summary: str | None = None
    next_action: str | None = None
    horizon: ObjectiveHorizon = ObjectiveHorizon.WEEK
    status: ObjectiveStatus = ObjectiveStatus.PLANNED
    priority: ObjectivePriority = ObjectivePriority.MEDIUM
    target_date: Date | None = None
    color: str = "#8da2fb"
    sort_order: int = 0
    linked_task_ids: list[str] = Field(default_factory=list)
    category: WeeklyPlanCategory = WeeklyPlanCategory.WORK
    date: Date | None = None
    start_time: str | None = None
    end_time: str | None = None
    duration_minutes: int = Field(default=60, ge=0, le=10_080)
    flexible: bool = False
    note: str | None = None

    @model_validator(mode="after")
    def validate_weekly_block(self):
        if self.kind == "weekly_block" and self.date is None:
            raise ValueError("date is required for a weekly block")
        return self


class ObjectiveUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    kind: ObjectiveKind | Literal["weekly_block"] | None = None
    week_id: str | None = None
    objective_id: str | None = None
    parent_id: str | None = None
    title: str | None = None
    summary: str | None = None
    next_action: str | None = None
    horizon: ObjectiveHorizon | None = None
    status: ObjectiveStatus | None = None
    priority: ObjectivePriority | None = None
    target_date: Date | None = None
    color: str | None = None
    sort_order: int | None = None
    archived: bool | None = None
    linked_task_ids: list[str] | None = None
    category: WeeklyPlanCategory | None = None
    date: Date | None = None
    start_time: str | None = None
    end_time: str | None = None
    duration_minutes: int | None = Field(default=None, ge=0, le=10_080)
    flexible: bool | None = None
    note: str | None = None
