"""Calendar-event request contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, model_validator

from ..core.dates import to_utc_naive
from .common import ApiRequest
from .enums import CalendarEventType, CalendarImpact


class CalendarEventCreateRequest(ApiRequest):
    title: str = "Untitled event"
    type: CalendarEventType = CalendarEventType.PERSONAL
    start: datetime
    end: datetime | None = None
    impact: CalendarImpact = CalendarImpact.MEDIUM
    expected_stress: int = Field(default=50, ge=0, le=100)
    expected_preparation_load: int = Field(default=50, ge=0, le=100)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end is not None and to_utc_naive(self.end) < to_utc_naive(self.start):
            raise ValueError("end must be after start")
        return self


class CalendarEventUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    title: str | None = None
    type: CalendarEventType | None = None
    start: datetime | None = None
    end: datetime | None = None
    impact: CalendarImpact | None = None
    expected_stress: int | None = Field(default=None, ge=0, le=100)
    expected_preparation_load: int | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def validate_time_range(self):
        if (
            self.start is not None
            and self.end is not None
            and to_utc_naive(self.end) < to_utc_naive(self.start)
        ):
            raise ValueError("end must be after start")
        return self
