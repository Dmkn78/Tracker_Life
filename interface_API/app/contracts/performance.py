from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from .common import ApiRequest


class PerformanceTargetRequest(ApiRequest):
    target_minutes: int = Field(ge=60, le=10080)


class WorkSessionRequest(ApiRequest):
    request_id: UUID
    title: str = Field(min_length=1, max_length=200)
    date: date
    actual_minutes: int = Field(ge=1, le=1440)
    objective_id: str | None = None

    @model_validator(mode="after")
    def validate_session(self):
        if not self.title.strip():
            raise ValueError("A work session needs a title")
        if self.date > date.today():
            raise ValueError("Work cannot be logged in the future")
        return self


class BlockExecutionRequest(ApiRequest):
    id: str = Field(min_length=1)
    execution_status: Literal["planned", "done", "partial", "not_done"]
    actual_minutes: int | None = Field(default=None, ge=0, le=1440)

    @model_validator(mode="after")
    def validate_execution(self):
        if self.execution_status in ("planned", "not_done") and self.actual_minutes:
            raise ValueError("Only done or partial work can have recorded minutes")
        return self
