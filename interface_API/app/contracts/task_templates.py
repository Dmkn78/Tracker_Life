"""Reusable task settings, independent of dates and execution history."""

from pydantic import Field, field_validator

from .common import ApiRequest
from .tasks import TaskItem
from .enums import TaskStatus


class TaskTemplateCreateRequest(ApiRequest):
    name: str = Field(min_length=1, max_length=120)
    fields: TaskItem

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        name = name.strip()
        if not name:
            raise ValueError("Add a template name")
        return name


def reusable_task_fields(fields: TaskItem) -> dict:
    reusable = fields.model_copy(update={
        "date": None,
        "status": TaskStatus.PLANNED,
        "completion_percent": 0,
        "not_done_reason": None,
    }).model_dump(mode="json", by_alias=True)
    reusable["title"] = fields.title or ""
    reusable["importance"] = reusable["importance"].lower()
    reusable["status"] = "planned"
    return reusable
