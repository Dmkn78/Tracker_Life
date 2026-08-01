"""Daily-log request contracts."""

from __future__ import annotations

from datetime import date as Date
from datetime import datetime as DateTime

from pydantic import Field

from .common import ApiRequest
from .enums import DailyLogStatus


class DailyLogUpsertRequest(ApiRequest):
    date: Date | None = None
    status: DailyLogStatus = DailyLogStatus.DRAFT
    energy: int | None = Field(default=None, ge=0, le=100)
    productivity: int | None = Field(default=None, ge=0, le=100)
    start_friction: int | None = Field(default=None, ge=0, le=100)
    calorie_target: int | None = Field(default=None, ge=0, le=20_000)
    calorie_percent: int | None = Field(default=None, ge=0, le=500)
    training_done: bool | None = None
    mental_fatigue: int | None = Field(default=None, ge=0, le=100)
    physical_fatigue: int | None = Field(default=None, ge=0, le=100)
    focus_quality: int | None = Field(default=None, ge=0, le=100)
    work_time_minutes: int | None = Field(default=None, ge=0, le=1_440)
    distraction_time_minutes: int | None = Field(default=None, ge=0, le=1_440)
    avoided_important_task: bool | None = None
    main_blocker: str | None = None
    improvement_tomorrow: str | None = None
    sleep_intent_clicked_at: DateTime | None = None
    estimated_sleep_delay_min: int | None = Field(default=None, ge=0, le=1_440)
    text_summary: str | None = None
    voice_transcript: str | None = None
