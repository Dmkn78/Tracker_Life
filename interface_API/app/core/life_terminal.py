"""Aggregated Life Terminal dashboard payload (lib/lifeTerminal.ts)."""

from __future__ import annotations

from datetime import datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CalendarEvent, DailyLog, Task, User
from .dates import add_days, get_iso_week_id, get_week_date_keys, iso_datetime, parse_date_key, to_date_key
from .metrics import build_weekly_json_export, compute_weekly_summary, get_trajectory, serialize_calendar_event
from .regime import build_transition_matrix_placeholder, compute_regime, simulate_next_week
from .scoring import _log_as_regime_dict
from .time_allocation import get_time_allocation_data
from .todo_metrics import (
    calculate_todo_metrics,
    get_calendar_context,
    get_next_high_impact_event,
    get_todo_metrics,
)

IMPACT_PRESSURE = {"LOW": 24, "MEDIUM": 48, "HIGH": 76, "CRITICAL": 94}


def _serialize_task(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "date": task.date.isoformat(),
        "importance": task.importance.lower(),
        "productive": task.productive,
        "estimatedMinutes": task.estimatedMinutes,
        "completionPercent": task.completionPercent,
        "status": task.status.lower(),
        "createdAt": iso_datetime(task.createdAt),
        "updatedAt": iso_datetime(task.updatedAt),
    }


def _pressure_for_events(events: list[CalendarEvent]) -> int:
    if not events:
        return 0
    strongest = max(IMPACT_PRESSURE[event.impact] for event in events)
    average_load = round(
        sum((event.expectedStress + event.expectedPreparationLoad) / 2 for event in events)
        / len(events)
    )
    return min(100, round(strongest * 0.6 + average_load * 0.4))


def _risk_band(risk_score: int | None) -> str:
    risk = risk_score or 0
    if risk >= 75:
        return "critical"
    if risk >= 60:
        return "high"
    if risk >= 40:
        return "medium"
    return "low"


def _trend(today: int | None, previous: int | None) -> int:
    if today is None or previous is None:
        return 0
    return today - previous


def _data_quality_status(enough_for_trend: bool, submitted_logs: int, missing_days: int) -> str:
    if enough_for_trend and missing_days == 0:
        return "complete"
    if submitted_logs > 0:
        return "partial"
    return "missing"


def _build_weekly_planner(tasks: list[Task], events: list[CalendarEvent], week_days: list[str]) -> dict:
    top_priorities = [
        _serialize_task(task)
        for task in sorted(
            [
                task
                for task in tasks
                if task.importance == "HIGH" and task.status not in ("DONE", "CANCELLED")
            ],
            key=lambda task: task.completionPercent,
            reverse=True,
        )[:3]
    ]
    major_events = [
        serialized
        for event in events
        if event.impact in ("HIGH", "CRITICAL") or event.type in ("EXAM", "INTERVIEW", "DEADLINE")
        if (serialized := serialize_calendar_event(event)) is not None
    ]
    first_priority = top_priorities[0]["title"] if top_priorities else None
    first_event = major_events[0]["title"] if major_events else None
    if first_event:
        objective = f"Prepare for {first_event}"
    elif first_priority:
        objective = f"Execute: {first_priority}"
    else:
        objective = "No explicit weekly objective"

    return {
        "objective": objective,
        "topPriorities": top_priorities,
        "tasksByDay": [
            {
                "date": date_key,
                "tasks": [
                    _serialize_task(task) for task in tasks if task.date.isoformat() == date_key
                ],
            }
            for date_key in week_days
        ],
        "majorEvents": major_events,
        "missingPlanningWarning": len(top_priorities) == 0,
    }


def _build_life_tape(
    today_log: DailyLog | None,
    previous_log: DailyLog | None,
    todo_metrics: dict,
    calendar_pressure: int,
) -> dict:
    state = today_log.stateScore if today_log else None
    risk = today_log.riskScore if today_log else None
    execution = (
        today_log.executionScore
        if today_log and today_log.executionScore is not None
        else round(todo_metrics["weightedCompletionRate"] * 100)
    )
    friction = today_log.startFriction if today_log else None
    energy = today_log.energy if today_log else None

    def previous_value(selector):
        return selector(previous_log) if previous_log else None

    items = [
        {"label": "STATE", "value": state, "delta": _trend(state, previous_value(lambda log: log.stateScore)), "inverted": False},
        {"label": "RISK", "value": risk, "delta": _trend(risk, previous_value(lambda log: log.riskScore)), "inverted": True},
        {"label": "EXECUTION", "value": execution, "delta": _trend(execution, previous_value(lambda log: log.executionScore)), "inverted": False},
        {"label": "FRICTION", "value": friction, "delta": _trend(friction, previous_value(lambda log: log.startFriction)), "inverted": True},
        {"label": "ENERGY", "value": energy, "delta": _trend(energy, previous_value(lambda log: log.energy)), "inverted": False},
    ]
    label = "HIGH" if calendar_pressure >= 70 else "MEDIUM" if calendar_pressure >= 45 else "LOW"
    return {"items": items, "calendarPressureLabel": label}


def _events_between(db: Session, user_id: str, from_key: str, to_key_exclusive: str) -> list[CalendarEvent]:
    return list(
        db.execute(
            select(CalendarEvent)
            .where(
                CalendarEvent.userId == user_id,
                CalendarEvent.start >= datetime.combine(parse_date_key(from_key), time.min),
                CalendarEvent.start < datetime.combine(parse_date_key(to_key_exclusive), time.min),
            )
            .order_by(CalendarEvent.start.asc())
        ).scalars()
    )


def _tasks_between(db: Session, user_id: str, from_key: str, to_key: str) -> list[Task]:
    return list(
        db.execute(
            select(Task)
            .where(
                Task.userId == user_id,
                Task.date >= parse_date_key(from_key),
                Task.date <= parse_date_key(to_key),
            )
            .order_by(Task.date.asc(), Task.importance.desc(), Task.createdAt.asc())
        ).scalars()
    )


def get_life_terminal_data(db: Session, user: User, today: str | None = None) -> dict:
    today = today or to_date_key()
    week_id = get_iso_week_id(today)
    week_days = get_week_date_keys(week_id)
    range_start = add_days(today, -29)
    range_end = add_days(today, 30)
    week_start, week_end = week_days[0], week_days[6]
    today_date = parse_date_key(today)

    today_log = db.execute(
        select(DailyLog).where(DailyLog.userId == user.id, DailyLog.date == today_date)
    ).scalar_one_or_none()
    previous_submitted_log = db.execute(
        select(DailyLog)
        .where(DailyLog.userId == user.id, DailyLog.date < today_date, DailyLog.status == "SUBMITTED")
        .order_by(DailyLog.date.desc())
        .limit(1)
    ).scalar_one_or_none()
    recent_submitted_logs = list(
        db.execute(
            select(DailyLog)
            .where(DailyLog.userId == user.id, DailyLog.date <= today_date, DailyLog.status == "SUBMITTED")
            .order_by(DailyLog.date.desc())
            .limit(14)
        ).scalars()
    )
    _, today_todo_metrics = get_todo_metrics(db, user.id, today)
    calendar_context = get_calendar_context(db, user.id, today)
    next_high_impact_event = get_next_high_impact_event(db, user.id, today)
    trajectory = get_trajectory(db, user.id, 30, today)
    weekly_summary = compute_weekly_summary(db, user.id, week_id)
    range_events = _events_between(db, user.id, range_start, add_days(range_end, 1))
    week_events = _events_between(db, user.id, week_start, add_days(week_end, 1))
    range_tasks = _tasks_between(db, user.id, range_start, range_end)
    week_tasks = _tasks_between(db, user.id, week_start, week_end)
    weekly_export = build_weekly_json_export(db, user.id, week_id)
    time_allocation = get_time_allocation_data(db, user.id, today)

    calendar_pressure_today = _pressure_for_events(
        [event for event in range_events if event.start.date().isoformat() == today]
    )
    regime = compute_regime(
        current_log=_log_as_regime_dict(today_log),
        previous_submitted_log=_log_as_regime_dict(previous_submitted_log),
        recent_submitted_logs=[_log_as_regime_dict(log) for log in reversed(recent_submitted_logs)],
        calendar=calendar_context,
        todo_metrics=today_todo_metrics,
        missing_days_this_week=weekly_summary["missingDays"],
    )
    submitted_trend_logs = len(
        [point for point in trajectory if point["status"] == "submitted" and point["stateScore"] is not None]
    )
    enriched_trajectory = []
    for point in trajectory:
        events = [event for event in range_events if event.start.date().isoformat() == point["date"]]
        tasks = [task for task in range_tasks if task.date.isoformat() == point["date"]]
        enriched_trajectory.append(
            {
                **point,
                "calendarPressure": _pressure_for_events(events),
                "todoCompletion": round(calculate_todo_metrics(tasks)["weightedCompletionRate"] * 100),
            }
        )

    active_tasks = [task for task in range_tasks if task.status not in ("DONE", "CANCELLED")]
    task_sections = {
        "today": [_serialize_task(task) for task in week_tasks if task.date.isoformat() == today],
        "thisWeek": [_serialize_task(task) for task in week_tasks],
        "overdue": [_serialize_task(task) for task in active_tasks if task.date.isoformat() < today],
        "highImportance": [_serialize_task(task) for task in active_tasks if task.importance == "HIGH"],
        "productive": [_serialize_task(task) for task in active_tasks if task.productive],
    }
    weekly_task_metrics = calculate_todo_metrics(week_tasks)
    pressure_level = max(calendar_pressure_today, round(calendar_context["averageStress"]))

    quick_log = (
        {
            "date": today,
            "status": today_log.status.lower(),
            "energy": today_log.energy if today_log.energy is not None else 50,
            "productivity": today_log.productivity if today_log.productivity is not None else 50,
            "startFriction": today_log.startFriction if today_log.startFriction is not None else 50,
            "calorieTarget": today_log.calorieTarget if today_log.calorieTarget is not None else user.calorieTarget,
            "caloriePercent": today_log.caloriePercent if today_log.caloriePercent is not None else 100,
            "trainingDone": today_log.trainingDone,
            "mentalFatigue": today_log.mentalFatigue if today_log.mentalFatigue is not None else 50,
            "physicalFatigue": today_log.physicalFatigue if today_log.physicalFatigue is not None else 50,
            "focusQuality": today_log.focusQuality if today_log.focusQuality is not None else 50,
            "workTimeMinutes": today_log.workTimeMinutes if today_log.workTimeMinutes is not None else 0,
            "distractionTimeMinutes": today_log.distractionTimeMinutes
            if today_log.distractionTimeMinutes is not None
            else 0,
            "avoidedImportantTask": today_log.avoidedImportantTask,
            "mainBlocker": today_log.mainBlocker or "none",
            "improvementTomorrow": today_log.improvementTomorrow or "",
            "sleepIntentClickedAt": iso_datetime(today_log.sleepIntentClickedAt),
            "estimatedSleepDelayMin": today_log.estimatedSleepDelayMin
            if today_log.estimatedSleepDelayMin is not None
            else user.defaultSleepDelayMin,
            "textSummary": today_log.textSummary or "",
            "voiceTranscript": today_log.voiceTranscript or "",
        }
        if today_log
        else {
            "date": today,
            "status": "draft",
            "energy": 50,
            "productivity": 50,
            "startFriction": 50,
            "calorieTarget": user.calorieTarget,
            "caloriePercent": 100,
            "trainingDone": None,
            "mentalFatigue": 50,
            "physicalFatigue": 50,
            "focusQuality": 50,
            "workTimeMinutes": 0,
            "distractionTimeMinutes": 0,
            "avoidedImportantTask": None,
            "mainBlocker": "none",
            "improvementTomorrow": "",
            "sleepIntentClickedAt": None,
            "estimatedSleepDelayMin": user.defaultSleepDelayMin,
            "textSummary": "",
            "voiceTranscript": "",
        }
    )

    return {
        "today": today,
        "weekId": week_id,
        "terminalHeader": {
            "date": today,
            "weekId": week_id,
            "regime": regime["regime"],
            "phase": calendar_context["activePhase"],
            "dailyLogStatus": (today_log.status if today_log else "MISSING").lower(),
            "nextHighImpactEvent": serialize_calendar_event(next_high_impact_event),
            "dataQuality": _data_quality_status(
                submitted_trend_logs >= 3, weekly_summary["submittedLogs"], weekly_summary["missingDays"]
            ),
            "risk": _risk_band(today_log.riskScore if today_log else None),
        },
        "lifeTape": _build_life_tape(
            today_log, previous_submitted_log, today_todo_metrics, pressure_level
        ),
        "regime": regime,
        "quant": {
            "projection": simulate_next_week(regime, calendar_context),
            "transitionMatrix": build_transition_matrix_placeholder(regime, calendar_context),
        },
        "calendarContext": {
            **calendar_context,
            "nextHighImpactEvent": serialize_calendar_event(next_high_impact_event),
            "pressureLevel": pressure_level,
        },
        "trajectory": enriched_trajectory,
        "enoughForTrend": submitted_trend_logs >= 3,
        "initialEvents": [
            serialized
            for event in range_events
            if (serialized := serialize_calendar_event(event)) is not None
        ],
        "taskSections": task_sections,
        "taskMetrics": {
            "today": today_todo_metrics,
            "week": weekly_task_metrics,
            "plannedVsDone": {
                "planned": len([task for task in week_tasks if task.status != "CANCELLED"]),
                "done": len(
                    [
                        task
                        for task in week_tasks
                        if task.status == "DONE" or task.completionPercent >= 100
                    ]
                ),
            },
        },
        "timeAllocation": {
            "dayBudgetMinutes": time_allocation["dayBudgetMinutes"],
            "targetWeightTotal": time_allocation["targetWeightTotal"],
            "actualMinutesTotal": time_allocation["actualMinutesTotal"],
            "plannedMinutesTotal": sum(row["plannedMinutes"] for row in time_allocation["rows"]),
            "rows": [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "objective": row["objective"],
                    "targetWeight": row["targetWeight"],
                    "actualWeight": row["actualWeight"],
                    "plannedMinutes": row["plannedMinutes"],
                    "autoPlannedMinutes": row["autoPlannedMinutes"],
                    "plannedMinutesManual": row["plannedMinutesManual"],
                    "actualMinutes": row["actualMinutes"],
                    "color": row["color"],
                }
                for row in time_allocation["rows"]
            ],
        },
        "quickLog": quick_log,
        "weeklyPlanner": _build_weekly_planner(week_tasks, week_events, week_days),
        "dataQuality": {
            "submittedLogsThisWeek": weekly_summary["submittedLogs"],
            "missingDays": weekly_summary["missingDays"],
            "missingDayKeys": weekly_summary["missingDayKeys"],
            "calendarEvents": len(week_events),
            "tasksTracked": len(week_tasks),
            "enoughDataForTrend": submitted_trend_logs >= 3,
            "enoughDataForRegimeDetection": len(recent_submitted_logs) >= 2 or today_log is not None,
            "weeklyExportPreview": weekly_export,
        },
    }
