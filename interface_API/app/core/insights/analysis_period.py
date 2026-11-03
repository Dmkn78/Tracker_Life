"""The inclusive date range an analysis covers, and the history restricted to it."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from ..dates import get_iso_week_id
from ..knowledge.projected_notes import DaySnapshot, TaskSnapshot
from ..knowledge.tracker_snapshot import TrackerSnapshot

DEFAULT_PERIOD_DAYS = 28
MAX_PERIOD_DAYS = 366


@dataclass(frozen=True)
class AnalysisPeriod:
    start: date
    end: date

    @property
    def day_count(self) -> int:
        return (self.end - self.start).days + 1

    def contains(self, day: date | None) -> bool:
        return day is not None and self.start <= day <= self.end

    def to_json(self) -> dict:
        return {"from": self.start.isoformat(), "to": self.end.isoformat()}


@dataclass(frozen=True)
class PeriodHistory:
    period: AnalysisPeriod
    days: list[DaySnapshot]
    tasks: list[TaskSnapshot]
    week_recaps: dict[str, str]
    snapshot: TrackerSnapshot


def resolve_analysis_period(start: date | None, end: date | None, today: date) -> AnalysisPeriod:
    resolved_end = end or today
    resolved_start = start or resolved_end - timedelta(days=DEFAULT_PERIOD_DAYS - 1)
    if resolved_start > resolved_end:
        raise ValueError("La date de début doit précéder la date de fin.")
    if (resolved_end - resolved_start).days >= MAX_PERIOD_DAYS:
        raise ValueError("La période analysée est limitée à un an.")
    period = AnalysisPeriod(resolved_start, resolved_end)
    return period


def restrict_history(snapshot: TrackerSnapshot, period: AnalysisPeriod) -> PeriodHistory:
    period_days = [day for day in snapshot.days if period.contains(day.day)]
    period_week_ids = {get_iso_week_id((period.start + timedelta(days=offset)).isoformat()) for offset in range(period.day_count)}
    history = PeriodHistory(
        period=period,
        days=period_days,
        tasks=[task for day in period_days for task in day.tasks],
        week_recaps={week_id: text for week_id, text in snapshot.week_recaps.items() if week_id in period_week_ids},
        snapshot=snapshot,
    )
    return history
