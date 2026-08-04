"""Task request contracts."""

from __future__ import annotations

from datetime import date as Date

from pydantic import Field

from .common import ApiRequest
from .enums import TaskImportance, TaskStatus


class TaskItem(ApiRequest):
    """One task's fields, used both for single-task create and each row of a batch create."""

    title: str
    description: str | None = None
    date: Date | None = None
    start_time: str | None = None
    end_time: str | None = None
    objective_id: str | None = None
    company_id: str | None = None
    company_name: str | None = None
    tag_ids: list[str] = Field(default_factory=list)
    tag_names: list[str] = Field(default_factory=list)
    importance: TaskImportance = TaskImportance.MEDIUM
    productive: bool = True
    estimated_minutes: int = Field(default=0, ge=0, le=10_080)
    completion_percent: int = Field(default=0, ge=0, le=100)
    status: TaskStatus = TaskStatus.PLANNED


class TaskCreateRequest(TaskItem):
    """Single-task create when `items` is absent, batch create when present.

    `title` is optional here (unlike TaskItem) because it is only required
    per-row when `items` is used.
    """

    title: str | None = None
    items: list[TaskItem] | None = None

    def resolve_items(self) -> list[TaskItem]:
        if self.items is not None:
            return self.items
        if not self.title:
            return []
        return [
            TaskItem(
                title=self.title,
                description=self.description,
                date=self.date,
                startTime=self.start_time,
                endTime=self.end_time,
                objectiveId=self.objective_id,
                companyId=self.company_id,
                companyName=self.company_name,
                tagIds=self.tag_ids,
                tagNames=self.tag_names,
                importance=self.importance,
                productive=self.productive,
                estimatedMinutes=self.estimated_minutes,
                completionPercent=self.completion_percent,
                status=self.status,
            )
        ]


class TaskUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    title: str | None = None
    description: str | None = None
    date: Date | None = None
    start_time: str | None = None
    end_time: str | None = None
    objective_id: str | None = None
    company_id: str | None = None
    company_name: str | None = None
    tag_ids: list[str] | None = None
    tag_names: list[str] | None = None
    importance: TaskImportance | None = None
    productive: bool | None = None
    estimated_minutes: int | None = Field(default=None, ge=0, le=10_080)
    completion_percent: int | None = Field(default=None, ge=0, le=100)
    status: TaskStatus | None = None
    sort_order: int | None = None


class TaskReorderRequest(ApiRequest):
    ids: list[str] = Field(min_length=1)
