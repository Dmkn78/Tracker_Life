from datetime import date as Date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..contracts.daily_log import DailyLogUpsertRequest
from ..database import get_db
from ..models import DailyLog, User, utcnow
from ..security import get_current_user
from ..core.dates import parse_date_key, to_date_key, to_utc_naive
from ..core.scoring import recompute_around_date, serialize_daily_log
from ..core.todo_metrics import get_calendar_context, get_todo_metrics

router = APIRouter(prefix="/api/daily-log", tags=["daily-log"])
PROTECTED_LOG_STATUSES = ("SUBMITTED", "SKIPPED", "ANALYZED")
MAX_STATUS_RANGE_DAYS = 70


@router.get("/statuses")
def get_daily_log_statuses(
    from_date: Date = Query(alias="from"),
    to_date: Date = Query(alias="to"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    range_days = (to_date - from_date).days
    if range_days < 0 or range_days > MAX_STATUS_RANGE_DAYS:
        raise HTTPException(status_code=400, detail="Invalid daily-log status range")
    logs = db.execute(
        select(DailyLog).where(
            DailyLog.userId == user.id,
            DailyLog.date >= from_date,
            DailyLog.date < to_date,
        )
    ).scalars()
    return {
        "statuses": {
            log.date.isoformat(): log.status.lower()
            for log in logs
        }
    }


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
    body: DailyLogUpsertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    date_key = body.date.isoformat() if body.date else to_date_key()
    status = body.status.value
    sleep_intent_clicked_at = (
        to_utc_naive(body.sleep_intent_clicked_at)
        if body.sleep_intent_clicked_at
        else None
    )
    estimated_sleep_delay_min = body.estimated_sleep_delay_min
    estimated_sleep_start = (
        sleep_intent_clicked_at + timedelta(minutes=estimated_sleep_delay_min)
        if sleep_intent_clicked_at and estimated_sleep_delay_min
        else None
    )

    values = {
        "status": status,
        "energy": body.energy,
        "productivity": body.productivity,
        "startFriction": body.start_friction,
        "calorieTarget": body.calorie_target,
        "caloriePercent": body.calorie_percent,
        "trainingDone": body.training_done,
        "mentalFatigue": body.mental_fatigue,
        "physicalFatigue": body.physical_fatigue,
        "focusQuality": body.focus_quality,
        "workTimeMinutes": body.work_time_minutes,
        "distractionTimeMinutes": body.distraction_time_minutes,
        "avoidedImportantTask": body.avoided_important_task,
        "mainBlocker": body.main_blocker,
        "improvementTomorrow": body.improvement_tomorrow,
        "sleepIntentClickedAt": sleep_intent_clicked_at,
        "estimatedSleepDelayMin": estimated_sleep_delay_min,
        "estimatedSleepStart": estimated_sleep_start,
        "textSummary": body.text_summary,
        "voiceTranscript": body.voice_transcript,
    }

    submitted_at = utcnow() if status == "SUBMITTED" else None
    insert_statement = insert(DailyLog).values(
        userId=user.id,
        date=parse_date_key(date_key),
        submittedAt=submitted_at,
        **values,
    )
    next_status = (
        case(
            (DailyLog.status.in_(PROTECTED_LOG_STATUSES), DailyLog.status),
            else_=status,
        )
        if status == "DRAFT"
        else status
    )
    update_values = {
        **values,
        "status": next_status,
        "updatedAt": utcnow(),
    }
    if submitted_at is not None:
        update_values["submittedAt"] = submitted_at
    db.execute(
        insert_statement.on_conflict_do_update(
            index_elements=[DailyLog.userId, DailyLog.date],
            set_=update_values,
        )
    )
    db.flush()

    updated = recompute_around_date(db, user.id, date_key)
    _, todo_metrics = get_todo_metrics(db, user.id, date_key)
    calendar = get_calendar_context(db, user.id, date_key)
    return {
        "log": serialize_daily_log(updated),
        "todoMetrics": todo_metrics,
        "calendarContext": calendar,
    }
