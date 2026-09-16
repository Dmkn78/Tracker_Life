from datetime import date as CalendarDate
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from .common import ApiRequest


class ObjectivePlanRequest(ApiRequest):
    objective_id: str
    start_date: CalendarDate
    effort_minutes: int = Field(ge=0, le=600000)
    impact: int = Field(ge=0, le=100)
    manual_progress: int | None = Field(default=None, ge=0, le=100)


class ProgressCheckpointRequest(ApiRequest):
    objective_id: str
    date: CalendarDate
    progress: int = Field(ge=0, le=100)

    @model_validator(mode="after")
    def validate_date(self):
        if self.date > CalendarDate.today():
            raise ValueError("Progress observations cannot be in the future")
        return self


class TaskPlanRequest(ApiRequest):
    task_id: str
    optimistic_minutes: int = Field(ge=1, le=600000)
    likely_minutes: int = Field(ge=1, le=600000)
    pessimistic_minutes: int = Field(ge=1, le=600000)
    predecessor_ids: list[str] = Field(default_factory=list, max_length=200)

    @model_validator(mode="after")
    def validate_estimates(self):
        if not self.optimistic_minutes <= self.likely_minutes <= self.pessimistic_minutes:
            raise ValueError("Estimates must follow optimistic <= likely <= pessimistic")
        if self.task_id in self.predecessor_ids:
            raise ValueError("A task cannot depend on itself")
        return self


class RecoveryRequest(ApiRequest):
    block_id: str
    action: Literal["replan", "ignore"]
    date: CalendarDate | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)

    @model_validator(mode="after")
    def validate_replan(self):
        if self.action == "replan" and (self.date is None or self.date < CalendarDate.today() or self.duration_minutes is None):
            raise ValueError("Replanning requires a date from today and a duration")
        return self


class PlanningDecisionRequest(ApiRequest):
    objective_id: str
    action: Literal["accept_forecast", "ignore", "reduce_scope"]
    forecast_date: CalendarDate | None = None
    effort_minutes: int | None = Field(default=None, ge=1, le=600000)


class ReallocationRequest(ApiRequest):
    block_id: str
    objective_id: str


class RecoveryScheduleRequest(ApiRequest):
    request_id: UUID
    objective_id: str
    start_date: CalendarDate
    days: int = Field(ge=1, le=14)
    daily_minutes: int = Field(ge=1, le=240)

    @model_validator(mode="after")
    def validate_start(self):
        if self.start_date < CalendarDate.today():
            raise ValueError("Recovery work must start today or later")
        return self
