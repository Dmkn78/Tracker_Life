"""Time-allocation request contracts."""

from __future__ import annotations

from datetime import date as Date
from typing import Literal

from pydantic import Field, model_validator

from .common import ApiRequest


class TimeAllocationCategoryCreateRequest(ApiRequest):
    name: str = "New allocation"
    objective: str | None = None
    target_weight: int = Field(default=0, ge=0, le=100)
    expected_return: int = Field(default=50, ge=0, le=100)
    risk: int = Field(default=50, ge=0, le=100)
    beta: float = Field(default=1, ge=0, le=10)
    color: str = "#22d3ee"


class TimeAllocationUpdateRequest(ApiRequest):
    kind: Literal["day_budget", "allocation", "portfolio"] | None = None
    id: str | None = None
    date: Date | None = None
    day_budget_minutes: int | None = Field(default=None, ge=0, le=1_440)
    category_id: str | None = None
    planned_minutes: int | None = Field(default=None, ge=0, le=10_080)
    planned_minutes_manual: bool | None = None
    actual_minutes: int | None = Field(default=None, ge=0, le=10_080)
    note: str | None = None
    name: str | None = None
    objective: str | None = None
    target_weight: int | None = Field(default=None, ge=0, le=100)
    expected_return: int | None = Field(default=None, ge=0, le=100)
    risk: int | None = Field(default=None, ge=0, le=100)
    beta: float | None = Field(default=None, ge=0, le=10)
    color: str | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def validate_target(self):
        if self.kind == "allocation" and not self.category_id:
            raise ValueError("categoryId is required for an allocation update")
        if self.kind == "portfolio" and not (self.name or "").strip():
            raise ValueError("name is required for a portfolio update")
        if self.kind is None and not self.id:
            raise ValueError("id is required for a category update")
        return self
