"""Task metrics and calendar context, ported from lib/todoMetrics.ts.

Computed structures are plain dicts with camelCase keys so they can be
returned to the frontend unchanged.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CalendarEvent, Task
from .dates import add_days, get_iso_week_id, get_week_date_keys, parse_date_key
from .numbers import javascript_round

IMPORTANCE_WEIGHT = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}


def calculate_todo_metrics(tasks: list[Task]) -> dict:
    active = [task for task in tasks if task.status != "CANCELLED"]
    total_weight = sum(IMPORTANCE_WEIGHT[task.importance] for task in active)
    completed_weight = sum(
        IMPORTANCE_WEIGHT[task.importance] * task.completionPercent / 100 for task in active
    )
    productive = [task for task in active if task.productive]
    productive_completion = (
        0
        if not productive
        else sum(task.completionPercent for task in productive) / (len(productive) * 100)
    )
    return {
        "tasksPlanned": len(active),
        "weightedCompletionRate": 0 if total_weight == 0 else completed_weight / total_weight,
        "missedImportantTasks": len(
            [
                task
                for task in active
                if task.importance == "HIGH" and task.completionPercent < 100 and task.status != "DONE"
            ]
        ),
        "productiveTaskCompletion": productive_completion,
    }


def get_todo_metrics(db: Session, user_id: str, date_key: str) -> tuple[list[Task], dict]:
    tasks = list(
        db.execute(
            select(Task)
            .where(Task.userId == user_id, Task.date == parse_date_key(date_key))
            .order_by(Task.importance.desc(), Task.createdAt.asc())
        ).scalars()
    )
    return tasks, calculate_todo_metrics(tasks)


def detect_active_phase_for_week(events: list[CalendarEvent]) -> str:
    high_impact = [event for event in events if event.impact in ("HIGH", "CRITICAL")]
    if any(event.type == "EXAM" for event in events):
        return "exam_week"
    if any(event.type == "INTERVIEW" for event in events):
        return "interview_week"
    if any(event.type == "DEADLINE" for event in events):
        return "deadline_week"
    if len(high_impact) > 1:
        return "high_pressure_week"
    return "normal_week"


def count_high_impact_events(events: list[CalendarEvent]) -> int:
    return len([event for event in events if event.impact in ("HIGH", "CRITICAL")])


def weekly_expected_load(events: list[CalendarEvent]) -> tuple[int, int]:
    if not events:
        return 0, 0
    stress = javascript_round(sum(event.expectedStress for event in events) / len(events))
    preparation = javascript_round(
        sum(event.expectedPreparationLoad for event in events) / len(events)
    )
    return stress, preparation


def get_next_high_impact_event(db: Session, user_id: str, date_key: str) -> CalendarEvent | None:
    from datetime import datetime, time

    start = datetime.combine(parse_date_key(date_key), time.min)
    return db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.userId == user_id,
            CalendarEvent.start >= start,
            CalendarEvent.impact.in_(["HIGH", "CRITICAL"]),
        )
        .order_by(CalendarEvent.start.asc())
        .limit(1)
    ).scalar_one_or_none()


def _events_between(db: Session, user_id: str, from_key: str, to_key_exclusive: str) -> list[CalendarEvent]:
    from datetime import datetime, time

    start = datetime.combine(parse_date_key(from_key), time.min)
    end = datetime.combine(parse_date_key(to_key_exclusive), time.min)
    return list(
        db.execute(
            select(CalendarEvent).where(
                CalendarEvent.userId == user_id,
                CalendarEvent.start >= start,
                CalendarEvent.start < end,
            )
        ).scalars()
    )


IMPACT_RANK = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def get_calendar_context(db: Session, user_id: str, date_key: str) -> dict:
    week_days = get_week_date_keys(get_iso_week_id(date_key))
    week_events = _events_between(db, user_id, week_days[0], add_days(week_days[6], 1))
    next_events = _events_between(db, user_id, date_key, add_days(date_key, 7))

    weekly_stress, weekly_preparation = weekly_expected_load(week_events)
    average_stress = (
        0 if not next_events else sum(event.expectedStress for event in next_events) / len(next_events)
    )
    average_preparation = (
        0
        if not next_events
        else sum(event.expectedPreparationLoad for event in next_events) / len(next_events)
    )
    max_impact = None
    for event in next_events:
        if max_impact is None or IMPACT_RANK.index(event.impact) > IMPACT_RANK.index(max_impact):
            max_impact = event.impact

    return {
        "activePhase": detect_active_phase_for_week(week_events),
        "highImpactEventsNext7d": count_high_impact_events(next_events),
        "maxImpact": max_impact,
        "averageStress": average_stress,
        "averagePreparationLoad": average_preparation,
        "weeklyExpectedStressLoad": weekly_stress,
        "weeklyExpectedPreparationLoad": weekly_preparation,
    }
