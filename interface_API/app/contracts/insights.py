"""Requests of the analysis engine."""

from __future__ import annotations

from datetime import date as Date

from pydantic import Field, model_validator

from .common import ApiRequest


class InsightQuestionRequest(ApiRequest):
    question: str = Field(min_length=1, max_length=2000)
    date_from: Date | None = Field(default=None, alias="from")
    date_to: Date | None = Field(default=None, alias="to")
    provider_id: str | None = Field(default=None, max_length=100)


class GoalDecompositionRequest(ApiRequest):
    objective_id: str | None = Field(default=None, max_length=100)
    text: str | None = Field(default=None, max_length=2000)
    provider_id: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def require_goal(self) -> GoalDecompositionRequest:
        if not self.objective_id and not (self.text or "").strip():
            raise ValueError("Provide an objective or a goal text")
        return self
