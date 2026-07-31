from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DAILY_LOG_STATUSES, DailyLog, User
from ..security import get_current_user
from ..core.dates import parse_date_key, parse_iso_datetime, to_date_key
from ..core.scoring import recompute_around_date, serialize_daily_log
from ..core.todo_metrics import get_calendar_context, get_todo_metrics

router = APIRouter(prefix="/api/daily-log", tags=["daily-log"])


def _status_from_input(value: str | None) -> str:
    upper = (value or "DRAFT").upper()
    return upper if upper in DAILY_LOG_STATUSES else "DRAFT"


@router.get("")
def get_daily_log(
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    date_key = date or to_date_key()
    log = db.execute(
        select(DailyLog).where(DailyLog.userId == user.id, DailyLog.date == parse_date_key(date_key))
    ).scalar_one_or_none()
    _, todo_metrics = get_todo_metrics(db, user.id, date_key)
    calendar = get_calendar_context(db, user.id, date_key)
    return {
        "log": serialize_daily_log(log),
        "todoMetrics": todo_metrics,
        "calendarContext": calendar,
    }


@router.post("")
def upsert_daily_log(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    date_key = body.get("date") or to_date_key()
    status = _status_from_input(body.get("status"))
    sleep_intent_clicked_at = (
        parse_iso_datetime(body["sleepIntentClickedAt"]) if body.get("sleepIntentClickedAt") else None
    )
    estimated_sleep_delay_min = body.get("estimatedSleepDelayMin")
    estimated_sleep_start = (
        sleep_intent_clicked_at + timedelta(minutes=estimated_sleep_delay_min)
        if sleep_intent_clicked_at and estimated_sleep_delay_min
        else None
    )

    values = {
        "status": status,
        "energy": body.get("energy"),
        "productivity": body.get("productivity"),
        "startFriction": body.get("startFriction"),
        "calorieTarget": body.get("calorieTarget"),
        "caloriePercent": body.get("caloriePercent"),
        "trainingDone": body.get("trainingDone"),
        "mentalFatigue": body.get("mentalFatigue"),
        "physicalFatigue": body.get("physicalFatigue"),
        "focusQuality": body.get("focusQuality"),
        "workTimeMinutes": body.get("workTimeMinutes"),
        "distractionTimeMinutes": body.get("distractionTimeMinutes"),
        "avoidedImportantTask": body.get("avoidedImportantTask"),
        "mainBlocker": body.get("mainBlocker"),
        "improvementTomorrow": body.get("improvementTomorrow"),
        "sleepIntentClickedAt": sleep_intent_clicked_at,
        "estimatedSleepDelayMin": estimated_sleep_delay_min,
        "estimatedSleepStart": estimated_sleep_start,
        "textSummary": body.get("textSummary"),
        "voiceTranscript": body.get("voiceTranscript"),
    }

    log = db.execute(
        select(DailyLog).where(DailyLog.userId == user.id, DailyLog.date == parse_date_key(date_key))
    ).scalar_one_or_none()
    if log is None:
        log = DailyLog(userId=user.id, date=parse_date_key(date_key), **values)
        db.add(log)
    else:
        for key, value in values.items():
            setattr(log, key, value)
    if status == "SUBMITTED":
        log.submittedAt = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()

    updated = recompute_around_date(db, user.id, date_key)
    _, todo_metrics = get_todo_metrics(db, user.id, date_key)
    calendar = get_calendar_context(db, user.id, date_key)
    return {
        "log": serialize_daily_log(updated),
        "todoMetrics": todo_metrics,
        "calendarContext": calendar,
    }
