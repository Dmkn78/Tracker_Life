"""Requests of the weekly board."""

from __future__ import annotations

from datetime import date as Date

from pydantic import Field

from .common import ApiRequest

WEEK_ID_PATTERN = r"^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$"
MAX_RECAP_LENGTH = 20_000


class RecapWriteRequest(ApiRequest):
    """Daily recap when `date` is set, weekly recap otherwise. Empty text clears it."""

    week_id: str | None = Field(default=None, pattern=WEEK_ID_PATTERN)
    date: Date | None = None
    text: str = Field(max_length=MAX_RECAP_LENGTH)
