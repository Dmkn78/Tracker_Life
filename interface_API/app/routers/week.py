"""The weekly board: one request returns everything the main screen needs."""

from __future__ import annotations

from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..contracts.week import WEEK_ID_PATTERN, RecapWriteRequest
from ..core.dates import get_iso_week_id, get_week_date_keys, parse_date_key, shift_week_id, to_date_key
from ..core.week_board import is_open_status, summarize_task_statuses
from ..database import get_db
from ..core.courses.deadline_kinds import DEADLINE_KIND_LABELS
from ..models import Course, CourseDeadline, DailyLog, Objective, Task, User, WeeklyRecap
from ..security import get_current_user

router = APIRouter(prefix="/api/week", tags=["week"])
MAX_INBOX_TASKS = 200


@router.get("")
def get_week(
    week_id: str | None = Query(default=None, alias="weekId", pattern=WEEK_ID_PATTERN),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    resolved_week_id = week_id or get_iso_week_id()
    try:
        date_keys = get_week_date_keys(resolved_week_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"Semaine invalide : {resolved_week_id}") from error
    week_dates = [parse_date_key(date_key) for date_key in date_keys]
    week_tasks = _load_tasks(db, user.id, and_(Task.date >= week_dates[0], Task.date <= week_dates[-1]))
    inbox_tasks = [row for row in _load_tasks(db, user.id, Task.date.is_(None)) if is_open_status(row[0].status)][:MAX_INBOX_TASKS]
    day_recaps = _load_day_recaps(db, user.id, week_dates)
    day_deadlines = _load_day_deadlines(db, user.id, week_dates)
    weekly_recap = db.get(WeeklyRecap, (user.id, resolved_week_id))
    week_board = {
        "weekId": resolved_week_id,
        "previousWeekId": shift_week_id(resolved_week_id, -1),
        "nextWeekId": shift_week_id(resolved_week_id, 1),
        "today": to_date_key(),
        "days": [
            {
                "date": date_key,
                "tasks": [_serialize_board_task(task, title) for task, title in week_tasks if task.date == day_date],
                "recap": day_recaps.get(day_date),
                "deadlines": day_deadlines.get(day_date, []),
            }
            for date_key, day_date in zip(date_keys, week_dates)
        ],
        "inbox": [_serialize_board_task(task, title) for task, title in inbox_tasks],
        "recap": weekly_recap.text if weekly_recap else None,
        "summary": summarize_task_statuses([task.status for task, _ in week_tasks]).to_json(),
    }
    return week_board


@router.put("/recap")
def write_recap(body: RecapWriteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    recap_text = body.text.strip()
    if body.date is not None:
        _write_day_recap(db, user.id, body.date, recap_text)
    elif body.week_id is not None:
        _write_week_recap(db, user.id, body.week_id, recap_text)
    else:
        raise HTTPException(status_code=400, detail="Indiquez une date ou une semaine.")
    db.flush()
    return {"ok": True, "text": recap_text or None}


def _load_tasks(db: Session, user_id: str, date_condition) -> list[tuple[Task, str | None]]:
    rows = db.execute(
        select(Task, Objective.title)
        .outerjoin(Objective, and_(Objective.id == Task.objectiveId, Objective.userId == user_id))
        .where(Task.userId == user_id, date_condition)
        .order_by(Task.sortOrder.asc(), Task.createdAt.asc())
    ).all()
    tasks_with_objective = [(task, objective_title) for task, objective_title in rows]
    return tasks_with_objective


def _load_day_recaps(db: Session, user_id: str, week_dates: list[Date]) -> dict[Date, str]:
    logs = db.scalars(select(DailyLog).where(
        DailyLog.userId == user_id, DailyLog.date >= week_dates[0], DailyLog.date <= week_dates[-1],
    ))
    recaps_by_date = {log.date: log.textSummary for log in logs if log.textSummary}
    return recaps_by_date


def _load_day_deadlines(db: Session, user_id: str, week_dates: list[Date]) -> dict[Date, list[dict]]:
    """Exams and submissions are shown on their day so the week is planned around them."""
    rows = db.execute(
        select(CourseDeadline, Course.name, Course.color)
        .outerjoin(Course, and_(Course.id == CourseDeadline.courseId, Course.userId == user_id))
        .where(CourseDeadline.userId == user_id, CourseDeadline.date >= week_dates[0], CourseDeadline.date <= week_dates[-1])
        .order_by(CourseDeadline.time.asc().nulls_first())
    ).all()
    deadlines_by_date: dict[Date, list[dict]] = {}
    for deadline, course_name, course_color in rows:
        deadlines_by_date.setdefault(deadline.date, []).append({
            "id": deadline.id, "title": deadline.title, "kind": deadline.kind, "kindLabel": DEADLINE_KIND_LABELS.get(deadline.kind, ""),
            "time": deadline.time, "courseName": course_name, "courseColor": course_color,
        })
    return deadlines_by_date


def _serialize_board_task(task: Task, objective_title: str | None) -> dict:
    board_task = {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "date": task.date.isoformat() if task.date else None,
        "status": task.status.lower(),
        "startTime": task.startTime,
        "estimatedMinutes": task.estimatedMinutes,
        "objectiveId": task.objectiveId,
        "objectiveTitle": objective_title,
    }
    return board_task


def _write_day_recap(db: Session, user_id: str, day: Date, recap_text: str) -> None:
    """Only `textSummary` changes: the rest of an existing daily log is left untouched."""
    log = db.scalar(select(DailyLog).where(DailyLog.userId == user_id, DailyLog.date == day))
    if log is None:
        if not recap_text:
            return
        db.add(DailyLog(userId=user_id, date=day, status="DRAFT", textSummary=recap_text))
        return
    log.textSummary = recap_text or None


def _write_week_recap(db: Session, user_id: str, week_id: str, recap_text: str) -> None:
    recap = db.get(WeeklyRecap, (user_id, week_id))
    if recap is None and recap_text:
        db.add(WeeklyRecap(userId=user_id, weekId=week_id, text=recap_text))
    elif recap is not None and recap_text:
        recap.text = recap_text
    elif recap is not None:
        db.delete(recap)
