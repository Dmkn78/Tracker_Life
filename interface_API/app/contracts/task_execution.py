from datetime import date as Date
from typing import Literal
from pydantic import Field, model_validator
from .common import ApiRequest


class TaskExecutionRequest(ApiRequest):
    task_id: str = Field(min_length=1)
    date: Date
    result: Literal["done", "partial", "not_done"]
    actual_minutes: int | None = Field(default=None, ge=0, le=1440)

    @model_validator(mode="after")
    def validate_execution(self):
        if self.date > Date.today():
            raise ValueError("Execution cannot be logged in the future")
        if self.result == "not_done" and self.actual_minutes:
            raise ValueError("Use partial or done when work was performed")
        return self
