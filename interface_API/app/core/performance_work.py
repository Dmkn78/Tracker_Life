from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import WeeklyPlanBlock


def recorded_day_minutes(db: Session, user_id: str, day: date, exclude_id: str | None = None) -> int:
    blocks = db.scalars(select(WeeklyPlanBlock).where(WeeklyPlanBlock.userId == user_id, WeeklyPlanBlock.date == day)).all()
    return sum(block.actualMinutes or 0 for block in blocks if block.id != exclude_id and block.executionStatus in ("done", "partial"))
