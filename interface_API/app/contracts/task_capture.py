from datetime import date as Date
from uuid import UUID
from pydantic import Field, field_validator
from .common import ApiRequest


class TaskCaptureRequest(ApiRequest):
    request_id: UUID
    title: str = Field(min_length=1, max_length=500)
    # Phone captures may target a day; without one the task lands in "À planifier".
    date: Date | None = None

    @field_validator("title")
    @classmethod
    def trim_title(cls, title: str) -> str:
        title = title.strip()
        if not title:
            raise ValueError("A task title is required")
        return title
