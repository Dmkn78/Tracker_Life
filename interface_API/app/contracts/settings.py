"""User-settings request contracts."""

from __future__ import annotations

from pydantic import Field

from .common import ApiRequest


class SettingsUpdateRequest(ApiRequest):
    calorie_target: int | None = Field(default=None, ge=0, le=20_000)
    default_sleep_delay_min: int | None = Field(default=None, ge=0, le=1_440)
