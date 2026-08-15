"""Daily score recomputation and DailyLog serialization (lib/scoring.ts)."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import DailyLog
from .dates import add_days, get_iso_week_id, iso_datetime, parse_date_key
from .metrics import (
    compute_execution_score,
    compute_risk_acceleration,
    compute_risk_delta,
    compute_risk_score,
    compute_state_score,
    compute_weekly_summary,
)
from .regime import compute_regime
from .todo_metrics import get_calendar_context, get_todo_metrics


def _log_as_regime_dict(log: DailyLog | None) -> dict | None:
    if log is None:
        return None
    return {
        "date": log.date,
        "status": log.status,
        "energy": log.energy,
        "productivity": log.productivity,
        "startFriction": log.startFriction,
        "trainingDone": log.trainingDone,
        "stateScore": log.stateScore,
        "executionScore": log.executionScore,
        "riskScore": log.riskScore,
        "riskDelta": log.riskDelta,
        "riskAcceleration": log.riskAcceleration,
        "regime": log.regime,
    }


def recompute_daily_scores(db: Session, user_id: str, date_key: str) -> DailyLog | None:
    day = parse_date_key(date_key)
    log = db.execute(
        select(DailyLog).where(DailyLog.userId == user_id, DailyLog.date == day)
    ).scalar_one_or_none()
    if log is None:
        return None

    _, metrics = get_todo_metrics(db, user_id, date_key)
    calendar = get_calendar_context(db, user_id, date_key)
    previous = db.execute(
        select(DailyLog)
        .where(DailyLog.userId == user_id, DailyLog.date < day, DailyLog.riskScore.is_not(None))
        .order_by(DailyLog.date.desc())
        .limit(1)
    ).scalar_one_or_none()
    previous_submitted = db.execute(
        select(DailyLog)
        .where(DailyLog.userId == user_id, DailyLog.date < day, DailyLog.status == "SUBMITTED")
        .order_by(DailyLog.date.desc())
        .limit(1)
    ).scalar_one_or_none()
    recent_submitted = list(
        db.execute(
            select(DailyLog)
            .where(DailyLog.userId == user_id, DailyLog.date <= day, DailyLog.status == "SUBMITTED")
            .order_by(DailyLog.date.desc())
            .limit(14)
        ).scalars()
    )
    week_start = day - timedelta(days=day.isoweekday() - 1)
    missing_logs = db.execute(
        select(func.count())
        .select_from(DailyLog)
        .where(
            DailyLog.userId == user_id,
            DailyLog.date >= week_start,
            DailyLog.date < day,
            DailyLog.status == "MISSING",
        )
    ).scalar_one()

    execution_score = compute_execution_score(log, metrics)
    state_score = compute_state_score(log)
    risk_score = compute_risk_score(
        log,
        metrics,
        calendar,
        missing_logs=missing_logs,
        previous_risk_delta=previous.riskDelta if previous else None,
        previous_risk_acceleration=previous.riskAcceleration if previous else None,
    )
    risk_delta = compute_risk_delta(risk_score, previous.riskScore if previous else None)
    risk_acceleration = compute_risk_acceleration(
        risk_delta, previous.riskDelta if previous else None
    )
    weekly_summary = compute_weekly_summary(db, user_id, get_iso_week_id(date_key))

    current = _log_as_regime_dict(log)
    current.update(
        {
            "executionScore": execution_score,
            "stateScore": state_score,
            "riskScore": risk_score,
            "riskDelta": risk_delta,
            "riskAcceleration": risk_acceleration,
        }
    )
    regime = compute_regime(
        current_log=current,
        previous_submitted_log=_log_as_regime_dict(previous_submitted),
        recent_submitted_logs=[_log_as_regime_dict(item) for item in reversed(recent_submitted)],
        calendar=calendar,
        todo_metrics=metrics,
        missing_days_this_week=weekly_summary["missingDays"],
    )

    log.executionScore = execution_score
    log.stateScore = state_score
    log.riskScore = risk_score
    log.riskDelta = risk_delta
    log.riskAcceleration = risk_acceleration
    log.regime = regime["regime"]
    log.regimeConfidence = regime["confidence"]
    db.flush()
    return log


def recompute_around_date(db: Session, user_id: str, date_key: str) -> DailyLog | None:
    updated = recompute_daily_scores(db, user_id, date_key)
    tomorrow_key = add_days(date_key, 1)
    tomorrow = db.execute(
        select(DailyLog).where(
            DailyLog.userId == user_id, DailyLog.date == parse_date_key(tomorrow_key)
        )
    ).scalar_one_or_none()
    if tomorrow is not None:
        recompute_daily_scores(db, user_id, tomorrow_key)
    return updated


def serialize_daily_log(log: DailyLog | None) -> dict | None:
    if log is None:
        return None
    return {
        "id": log.id,
        "date": log.date.isoformat(),
        "status": log.status.lower(),
        "energy": log.energy,
        "productivity": log.productivity,
        "startFriction": log.startFriction,
        "calorieTarget": log.calorieTarget,
        "caloriePercent": log.caloriePercent,
        "trainingDone": log.trainingDone,
        "mentalFatigue": log.mentalFatigue,
        "physicalFatigue": log.physicalFatigue,
        "focusQuality": log.focusQuality,
        "workTimeMinutes": log.workTimeMinutes,
        "distractionTimeMinutes": log.distractionTimeMinutes,
        "avoidedImportantTask": log.avoidedImportantTask,
        "mainBlocker": log.mainBlocker,
        "improvementTomorrow": log.improvementTomorrow or "",
        "wins": log.wins or [],
        "topImprovements": log.topImprovements or [],
        "blockers": log.blockers or [],
        "tomorrowPriorities": log.tomorrowPriorities or [],
        "tags": log.tags or [],
        "customFields": log.customFields,
        "sleepIntentClickedAt": iso_datetime(log.sleepIntentClickedAt),
        "estimatedSleepDelayMin": log.estimatedSleepDelayMin,
        "estimatedSleepStart": iso_datetime(log.estimatedSleepStart),
        "textSummary": log.textSummary or "",
        "voiceTranscript": log.voiceTranscript or "",
        "executionScore": log.executionScore,
        "stateScore": log.stateScore,
        "riskScore": log.riskScore,
        "riskDelta": log.riskDelta,
        "riskAcceleration": log.riskAcceleration,
        "regime": log.regime,
        "regimeConfidence": log.regimeConfidence,
        "submittedAt": iso_datetime(log.submittedAt),
        "createdAt": iso_datetime(log.createdAt),
        "updatedAt": iso_datetime(log.updatedAt),
    }
