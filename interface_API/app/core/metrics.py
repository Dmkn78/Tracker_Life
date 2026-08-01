"""Score computation, weekly summary, trajectory and weekly export.

Ported from lib/metrics.ts.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CalendarEvent, DailyLog
from .dates import add_days, get_iso_week_id, get_week_date_keys, iso_datetime, parse_date_key, to_date_key
from .numbers import javascript_round
from .todo_metrics import get_calendar_context, get_todo_metrics


def clamp_score(score: float) -> int:
    return max(0, min(100, javascript_round(score)))


def clamp_count(count: int, maximum: int = 7) -> int:
    return max(0, min(maximum, javascript_round(count)))


def weighted_average(parts: list[tuple[float | None, float]]) -> float | None:
    available = [(value, weight) for value, weight in parts if value is not None]
    total_weight = sum(weight for _, weight in available)
    if total_weight == 0:
        return None
    return sum(value * weight for value, weight in available) / total_weight


def compute_state_score(log: DailyLog) -> int | None:
    score = weighted_average(
        [
            (log.energy, 0.35),
            (log.productivity, 0.25),
            (None if log.startFriction is None else 100 - log.startFriction, 0.2),
            (log.focusQuality, 0.1),
            (None if log.mentalFatigue is None else 100 - log.mentalFatigue, 0.1),
        ]
    )
    return None if score is None else clamp_score(score)


def compute_execution_score(log: DailyLog, metrics: dict) -> int:
    score = metrics["weightedCompletionRate"] * 82
    if log.status == "SUBMITTED":
        score += 8
    if log.trainingDone is True:
        score += 6
    if log.avoidedImportantTask is True:
        score -= 12
    return clamp_score(score)


def compute_risk_score(
    log: DailyLog,
    metrics: dict,
    calendar: dict,
    missing_logs: int = 0,
    previous_risk_delta: int | None = None,
    previous_risk_acceleration: int | None = None,
) -> int:
    energy = log.energy if log.energy is not None else 50
    productivity = log.productivity if log.productivity is not None else 50
    start_friction = log.startFriction if log.startFriction is not None else 50
    calorie_percent = log.caloriePercent if log.caloriePercent is not None else 100
    risk = 14.0

    if energy < 35:
        risk += 18
    elif energy < 50:
        risk += 10
    if productivity < 35:
        risk += 16
    elif productivity < 50:
        risk += 8
    if start_friction > 75:
        risk += 16
    elif start_friction > 55:
        risk += 8

    calorie_deviation = abs(calorie_percent - 100)
    if calorie_deviation > 40:
        risk += 14
    elif calorie_deviation > 20:
        risk += 8
    if log.trainingDone is False:
        risk += 8
    if (log.mentalFatigue or 0) > 70:
        risk += 10
    if (log.physicalFatigue or 0) > 70:
        risk += 8
    if log.avoidedImportantTask is True:
        risk += 12
    risk += min(18, metrics["missedImportantTasks"] * 6)
    risk += min(12, (missing_logs or 0) * 3)
    if calendar["maxImpact"] == "CRITICAL":
        risk += 14
    elif calendar["maxImpact"] == "HIGH":
        risk += 9
    risk += min(8, javascript_round(calendar["averageStress"] / 18))
    if (previous_risk_delta or 0) > 0:
        risk += 4
    if (previous_risk_acceleration or 0) > 0:
        risk += 4

    return clamp_score(risk)


def compute_risk_delta(today_risk: int, previous_risk: int | None) -> int:
    return 0 if previous_risk is None else today_risk - previous_risk


def compute_risk_acceleration(today_delta: int, previous_delta: int | None) -> int:
    return 0 if previous_delta is None else today_delta - previous_delta


def compute_weekly_summary(db: Session, user_id: str, week_id: str | None = None) -> dict:
    week_id = week_id or get_iso_week_id()
    days = get_week_date_keys(week_id)
    logs = list(
        db.execute(
            select(DailyLog)
            .where(DailyLog.userId == user_id, DailyLog.date.in_([parse_date_key(day) for day in days]))
            .order_by(DailyLog.date.asc())
        ).scalars()
    )
    existing = {log.date.isoformat() for log in logs}

    def avg(values: list[int]) -> int | None:
        return None if not values else javascript_round(sum(values) / len(values))

    def collect(selector) -> list[int]:
        return [selector(log) for log in logs if selector(log) is not None]

    missing_days = [day for day in days if day not in existing]
    skipped_days = sorted({log.date.isoformat() for log in logs if log.status == "SKIPPED"})
    submitted_days = sorted({log.date.isoformat() for log in logs if log.status == "SUBMITTED"})
    training_days = sorted({log.date.isoformat() for log in logs if log.trainingDone is True})
    calendar_context = get_calendar_context(db, user_id, days[0])

    return {
        "weekId": week_id,
        "period": {"start": days[0], "end": days[6]},
        "avgStateScore": avg(collect(lambda log: log.stateScore)),
        "avgRiskScore": avg(collect(lambda log: log.riskScore)),
        "avgExecutionScore": avg(collect(lambda log: log.executionScore)),
        "avgStartFriction": avg(collect(lambda log: log.startFriction)),
        "submittedLogs": clamp_count(len(submitted_days), len(days)),
        "missingDays": clamp_count(len(missing_days), len(days)),
        "missingDayKeys": missing_days,
        "skippedDays": clamp_count(len(skipped_days), len(days)),
        "skippedDayKeys": skipped_days,
        "trainingDays": clamp_count(len(training_days), len(days)),
        "activePhase": calendar_context["activePhase"],
        "calendarContext": calendar_context,
    }


def build_interpretation_messages(
    logs: list[DailyLog],
    weekly_summary: dict,
    calendar_context: dict,
    execution_improved: bool = False,
) -> list[str]:
    submitted = sorted(
        [log for log in logs if log.status == "SUBMITTED" and log.riskScore is not None],
        key=lambda log: log.date,
    )
    last3 = submitted[-3:]
    messages: list[str] = []
    if len(last3) == 3 and all(
        last3[index].riskScore > last3[index - 1].riskScore for index in range(1, 3)
    ):
        messages.append("Risk is rising.")
    if len(last3) == 3 and all(
        (last3[index].startFriction or 0) > (last3[index - 1].startFriction or 0)
        for index in range(1, 3)
    ):
        messages.append("Start friction is rising.")
    if execution_improved:
        messages.append("Execution is improving.")
    if calendar_context["activePhase"] in (
        "exam_week", "interview_week", "deadline_week", "high_pressure_week",
    ):
        messages.append("Current week contains high-context pressure.")
    if weekly_summary["missingDays"] > 0:
        messages.append("Data quality is incomplete this week.")
    if not messages:
        messages.append("No strong regime shift signal is visible yet.")
    return messages


def get_trajectory(db: Session, user_id: str, days: int = 30, end_date: str | None = None) -> list[dict]:
    end_date = end_date or to_date_key()
    start = add_days(end_date, -(days - 1))
    logs = list(
        db.execute(
            select(DailyLog)
            .where(
                DailyLog.userId == user_id,
                DailyLog.date >= parse_date_key(start),
                DailyLog.date <= parse_date_key(end_date),
            )
            .order_by(DailyLog.date.asc())
        ).scalars()
    )
    by_date = {log.date.isoformat(): log for log in logs}
    trajectory = []
    for index in range(days):
        date_key = add_days(start, index)
        log = by_date.get(date_key)
        trajectory.append(
            {
                "date": date_key,
                "status": log.status.lower() if log else "missing",
                "stateScore": log.stateScore if log else None,
                "riskScore": log.riskScore if log else None,
                "executionScore": log.executionScore if log else None,
                "startFriction": log.startFriction if log else None,
                "productivity": log.productivity if log else None,
                "energy": log.energy if log else None,
                "caloriePercent": log.caloriePercent if log else None,
            }
        )
    return trajectory


def build_weekly_json_export(db: Session, user_id: str, week_id: str | None = None) -> dict:
    week_id = week_id or get_iso_week_id()
    summary = compute_weekly_summary(db, user_id, week_id)
    days = []
    for date_key in get_week_date_keys(week_id):
        log = db.execute(
            select(DailyLog).where(DailyLog.userId == user_id, DailyLog.date == parse_date_key(date_key))
        ).scalar_one_or_none()
        _, todo_metrics = get_todo_metrics(db, user_id, date_key)
        calendar = get_calendar_context(db, user_id, date_key)
        days.append(
            {
                "date": date_key,
                "status": (log.status if log else "MISSING").lower(),
                "inputs": {
                    "energy": log.energy if log else None,
                    "productivity": log.productivity if log else None,
                    "start_friction": log.startFriction if log else None,
                    "calorie_target": log.calorieTarget if log else None,
                    "calorie_percent": log.caloriePercent if log else None,
                    "training_done": log.trainingDone if log else None,
                    "mental_fatigue": log.mentalFatigue if log else None,
                    "physical_fatigue": log.physicalFatigue if log else None,
                    "focus_quality": log.focusQuality if log else None,
                    "work_time_minutes": log.workTimeMinutes if log else None,
                    "distraction_time_minutes": log.distractionTimeMinutes if log else None,
                    "avoided_important_task": log.avoidedImportantTask if log else None,
                    "main_blocker": log.mainBlocker if log else None,
                    "improvement_tomorrow": log.improvementTomorrow if log else None,
                    "text_summary": log.textSummary if log else None,
                    "voice_transcript": log.voiceTranscript if log else None,
                },
                "todo_metrics": {
                    "tasks_planned": todo_metrics["tasksPlanned"],
                    "weighted_completion_rate": round(todo_metrics["weightedCompletionRate"], 2),
                    "missed_high_importance_tasks": todo_metrics["missedImportantTasks"],
                    "productive_task_completion": round(todo_metrics["productiveTaskCompletion"], 2),
                },
                "calendar_context": {
                    "active_phase": calendar["activePhase"],
                    "high_impact_events_next_7d": calendar["highImpactEventsNext7d"],
                    "expected_stress_load": javascript_round(calendar["averageStress"]),
                    "expected_preparation_load": javascript_round(calendar["averagePreparationLoad"]),
                },
                "computed_scores": {
                    "state_score": log.stateScore if log else None,
                    "execution_score": log.executionScore if log else None,
                    "risk_score": log.riskScore if log else None,
                    "risk_delta": log.riskDelta if log else None,
                    "risk_acceleration": log.riskAcceleration if log else None,
                },
            }
        )

    logs = list(
        db.execute(
            select(DailyLog)
            .where(
                DailyLog.userId == user_id,
                DailyLog.date >= parse_date_key(summary["period"]["start"]),
                DailyLog.date <= parse_date_key(summary["period"]["end"]),
            )
            .order_by(DailyLog.date.asc())
        ).scalars()
    )
    interpretation = build_interpretation_messages(logs, summary, summary["calendarContext"])

    return {
        "week_id": week_id,
        "generated_at": iso_datetime(datetime.now(timezone.utc).replace(tzinfo=None)),
        "period": summary["period"],
        "calendar_context": {
            "active_phase": summary["calendarContext"]["activePhase"],
            "high_impact_events_next_7d": summary["calendarContext"]["highImpactEventsNext7d"],
            "expected_stress_load": javascript_round(summary["calendarContext"]["averageStress"]),
            "expected_preparation_load": javascript_round(summary["calendarContext"]["averagePreparationLoad"]),
        },
        "weekly_summary": {
            "avg_state_score": summary["avgStateScore"],
            "avg_risk_score": summary["avgRiskScore"],
            "avg_execution_score": summary["avgExecutionScore"],
            "avg_start_friction": summary["avgStartFriction"],
            "submitted_logs": summary["submittedLogs"],
            "missing_days": summary["missingDays"],
            "skipped_days": summary["skippedDays"],
            "training_days": summary["trainingDays"],
        },
        "days": days,
        "missing_days": summary["missingDayKeys"],
        "skipped_days": summary["skippedDayKeys"],
        "interpretation": interpretation,
    }


def serialize_calendar_event(event: CalendarEvent | None) -> dict | None:
    if event is None:
        return None
    return {
        "id": event.id,
        "title": event.title,
        "type": event.type.lower(),
        "start": iso_datetime(event.start),
        "end": iso_datetime(event.end),
        "impact": event.impact.lower(),
        "expectedStress": event.expectedStress,
        "expectedPreparationLoad": event.expectedPreparationLoad,
    }
