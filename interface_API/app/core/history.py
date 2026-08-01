"""History read model for the server-rendered review page."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import DailyLog
from .dates import add_days, get_iso_week_id, get_week_date_keys, iso_datetime, parse_date_key, to_date_key
from .metrics import compute_weekly_summary

HISTORY_FILTERS = ("last7", "last30", "week", "all")


def get_history_data(db: Session, user_id: str, history_filter: str = "last30") -> dict:
    if history_filter not in HISTORY_FILTERS:
        raise ValueError("Unsupported history filter")

    today = to_date_key()
    if history_filter == "week":
        dates: list[str] | None = list(reversed(get_week_date_keys(get_iso_week_id(today))))
    elif history_filter == "last7":
        dates = [add_days(today, -index) for index in range(7)]
    elif history_filter == "all":
        dates = None
    else:
        dates = [add_days(today, -index) for index in range(30)]

    query = select(DailyLog).where(DailyLog.userId == user_id)
    if dates is not None:
        query = query.where(DailyLog.date.in_([parse_date_key(date) for date in dates]))
    logs = list(db.execute(query.order_by(DailyLog.date.desc())).scalars())
    serialized_logs = [serialize_history_log(log) for log in logs]

    return {
        "filter": history_filter,
        "visibleDates": dates or [log["date"] for log in serialized_logs],
        "logs": serialized_logs,
        "weeklySummary": compute_weekly_summary(db, user_id, get_iso_week_id(today)),
    }


def serialize_history_log(log: DailyLog) -> dict:
    return {
        "date": log.date.isoformat(),
        "status": log.status.lower(),
        "updatedAt": iso_datetime(log.updatedAt),
        "energy": log.energy,
        "productivity": log.productivity,
        "executionScore": log.executionScore,
        "stateScore": log.stateScore,
        "riskScore": log.riskScore,
    }
