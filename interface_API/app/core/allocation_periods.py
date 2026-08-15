"""Canonical civil ranges for Time Allocation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

AllocationPeriod = Literal["day", "week", "month"]


@dataclass(frozen=True)
class AllocationPeriodRange:
    period: AllocationPeriod
    anchor: date
    start: date
    end: date
    end_exclusive: date
    maximum_budget_minutes: int


def allocation_period_range(period: AllocationPeriod, requested_date: date) -> AllocationPeriodRange:
    if period == "day":
        anchor = requested_date
        end_exclusive = anchor + timedelta(days=1)
    elif period == "week":
        anchor = requested_date - timedelta(days=requested_date.weekday())
        end_exclusive = anchor + timedelta(days=7)
    else:
        anchor = requested_date.replace(day=1)
        if anchor.month == 12:
            end_exclusive = date(anchor.year + 1, 1, 1)
        else:
            end_exclusive = date(anchor.year, anchor.month + 1, 1)
    day_count = (end_exclusive - anchor).days
    return AllocationPeriodRange(
        period=period,
        anchor=anchor,
        start=anchor,
        end=end_exclusive - timedelta(days=1),
        end_exclusive=end_exclusive,
        maximum_budget_minutes=day_count * 1_440,
    )


def require_canonical_anchor(period: AllocationPeriod, requested_date: date) -> AllocationPeriodRange:
    period_range = allocation_period_range(period, requested_date)
    if requested_date != period_range.anchor:
        raise ValueError(f"date must be the canonical {period} anchor: {period_range.anchor.isoformat()}")
    return period_range


def default_budget_minutes(period_range: AllocationPeriodRange) -> int:
    return (period_range.end_exclusive - period_range.start).days * 12 * 60
