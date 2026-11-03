"""Contract of an AI goal decomposition (proposals only; the user decides what becomes a task)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

MAX_GOAL_STEPS = 8


class GoalStep(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    title: str = Field(min_length=1, max_length=240)
    detail: str | None = Field(max_length=600)


class GoalSteps(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    steps: list[GoalStep] = Field(min_length=1, max_length=MAX_GOAL_STEPS)
