"""Requests of the courses screen."""

from __future__ import annotations

from datetime import date as Date

from pydantic import Field

from ..core.courses.deadline_kinds import DeadlineKind
from .common import ApiRequest

TIME_PATTERN = r"^(?:[01]\d|2[0-3]):[0-5]\d$"
COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"


class CourseCreateRequest(ApiRequest):
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)


class CourseUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)
    archived: bool | None = None


class DeadlineCreateRequest(ApiRequest):
    course_id: str | None = None
    title: str = Field(min_length=1, max_length=240)
    kind: DeadlineKind = "other"
    date: Date
    time: str | None = Field(default=None, pattern=TIME_PATTERN)
    duration_minutes: int = Field(default=60, ge=1, le=1440)
    note: str | None = Field(default=None, max_length=2000)


class DeadlineUpdateRequest(ApiRequest):
    id: str = Field(min_length=1)
    course_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=240)
    kind: DeadlineKind | None = None
    date: Date | None = None
    time: str | None = Field(default=None, pattern=TIME_PATTERN)
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    note: str | None = Field(default=None, max_length=2000)
