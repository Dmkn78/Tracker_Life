"""Pure scheduling helpers for recurring habits and routine blocks."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta


ALL_ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]


def normalize_recurrence_days(days: list[int] | None) -> list[int]:
    normalized = sorted(set(days or ALL_ISO_WEEKDAYS))
    if not normalized or any(day < 1 or day > 7 for day in normalized):
        raise ValueError("recurrence days must contain ISO weekdays from 1 to 7")
    return normalized


def is_scheduled_on(day: date, recurrence_days: list[int] | None) -> bool:
    return day.isoweekday() in normalize_recurrence_days(recurrence_days)


def end_time_for_duration(start_time: str, duration_minutes: int) -> str:
    hours, minutes = (int(value) for value in start_time.split(":"))
    total_minutes = hours * 60 + minutes + max(0, duration_minutes)
    return f"{(total_minutes // 60) % 24:02d}:{total_minutes % 60:02d}"


def routine_occurrence_bounds(day: date, start_time: str, end_time: str) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.fromisoformat(start_time))
    end = datetime.combine(day, time.fromisoformat(end_time))
    if end <= start:
        end += timedelta(days=1)
    return start, end
