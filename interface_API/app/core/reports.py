"""Weekly report generation and persistence (lib/reports.ts)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import WeeklyReport
from .dates import get_iso_week_id
from .metrics import build_weekly_json_export


def generate_weekly_report(db: Session, user_id: str, week_id: str | None = None) -> dict:
    week_id = week_id or get_iso_week_id()
    report = build_weekly_json_export(db, user_id, week_id)

    existing = db.execute(
        select(WeeklyReport).where(WeeklyReport.userId == user_id, WeeklyReport.weekId == week_id)
    ).scalar_one_or_none()
    if existing is None:
        db.add(WeeklyReport(userId=user_id, weekId=week_id, content=report))
    else:
        existing.content = report
    db.flush()
    return report
