"""Task request contracts."""

from __future__ import annotations

from datetime import date as Date

from pydantic import Field

from .common import ApiRequest
from .enums import TaskImportance, TaskStatus


class TaskCreateRequest(ApiRequest):
    title: str | None = None
    titles: list[str] | None = None
    date: Date | None = None
    objective_id: str | None = None
    importance: TaskImportance = TaskImportance.MEDIUM
    productive: bool = True
    estimated_minutes: int = Field(default=0, ge=0, le=10_080)
    completion_percent: int = Field(default=0, ge=0, le=100)
    status: TaskStatus = TaskStatus.PLANNED


class TaskUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    title: str | None = None
    date: Date | None = None
    objective_id: str | None = None
    importance: TaskImportance | None = None
    productive: bool | None = None
    estimated_minutes: int | None = Field(default=None, ge=0, le=10_080)
    completion_percent: int | None = Field(default=None, ge=0, le=100)
    status: TaskStatus | None = None
