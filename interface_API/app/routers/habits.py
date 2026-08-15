from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..contracts.habits import HabitCreateRequest, HabitUpdateRequest
from ..database import get_db
from ..models import Habit, HabitTemplate, RoutineBlock, User
from ..security import get_current_user
from ..core.dates import iso_datetime, parse_date_key, to_date_key
from ..core.habits import (
    get_calendar_routine_plans,
    get_habit_tracker_data,
    serialize_habit_template,
    synchronize_habit_routine_block,
    upsert_habit_checkin,
)
from ..core.habit_schedule import is_scheduled_on

router = APIRouter(prefix="/api/habits", tags=["habits"])


def serialize_habit(habit: Habit) -> dict:
    return {
        "id": habit.id,
        "userId": habit.userId,
        "name": habit.name,
        "category": habit.category,
        "description": habit.description,
        "targetTime": habit.targetTime,
        "defaultExpectedMinutes": habit.defaultExpectedMinutes,
        "recurrenceDays": habit.recurrenceDays,
        "timeBlockEnabled": habit.timeBlockEnabled,
        "sortOrder": habit.sortOrder,
        "active": habit.active,
        "source": habit.source,
        "createdAt": iso_datetime(habit.createdAt),
        "updatedAt": iso_datetime(habit.updatedAt),
    }


@router.get("")
def get_habits(
    date: str | None = Query(default=None),
    kind: str = Query(default="tracker"),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if kind == "calendar":
        if not from_ or not to:
            raise HTTPException(status_code=422, detail="from and to are required for routine calendar data")
        try:
            return get_calendar_routine_plans(db, user.id, from_, to)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
    return get_habit_tracker_data(db, user.id, date or to_date_key())


@router.post("")
def create_habit(
    body: HabitCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.kind == "template":
        template = HabitTemplate(
            userId=user.id,
            name=body.name or "New habit template",
            category=body.category or "routine",
            description=body.description,
            targetTime=body.target_time,
            defaultExpectedMinutes=body.default_expected_minutes,
            recurrenceDays=body.recurrence_days,
            timeBlockEnabled=body.time_block_enabled,
        )
        db.add(template)
        db.flush()
        return {"template": serialize_habit_template(template)}
    habit = Habit(
        userId=user.id,
        name=body.name or "New habit",
        category=body.category or "routine",
        description=body.description,
        targetTime=body.target_time,
        defaultExpectedMinutes=body.default_expected_minutes,
        recurrenceDays=body.recurrence_days,
        timeBlockEnabled=body.time_block_enabled,
        sortOrder=body.sort_order,
        source="manual",
    )
    db.add(habit)
    db.flush()
    synchronize_habit_routine_block(db, habit)
    if body.save_as_template:
        db.add(HabitTemplate(
            userId=user.id,
            name=habit.name,
            category=habit.category,
            description=habit.description,
            targetTime=habit.targetTime,
            defaultExpectedMinutes=habit.defaultExpectedMinutes,
            recurrenceDays=habit.recurrenceDays,
            timeBlockEnabled=habit.timeBlockEnabled,
        ))
    db.flush()
    return {"habit": serialize_habit(habit)}


@router.patch("")
def update_habit(
    body: HabitUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.kind == "checkin":
        date_key = body.date.isoformat() if body.date else to_date_key()
        habit = db.execute(
            select(Habit).where(Habit.id == body.habit_id, Habit.userId == user.id)
        ).scalar_one_or_none()
        if habit is None:
            raise HTTPException(status_code=400, detail="Invalid habitId")
        if not is_scheduled_on(parse_date_key(date_key), habit.recurrenceDays):
            raise HTTPException(status_code=422, detail="Habit is not scheduled for this date")
        upsert_habit_checkin(
            db,
            user_id=user.id,
            habit_id=body.habit_id or "",
            date_key=date_key,
            status=body.status,
            actual_minutes=body.actual_minutes,
            note=body.note,
        )
        return get_habit_tracker_data(db, user.id, date_key)

    existing = db.execute(
        select(Habit).where(Habit.id == body.id, Habit.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    if body.name is not None:
        existing.name = body.name
    if body.category is not None:
        existing.category = body.category
    if "description" in body.model_fields_set:
        existing.description = body.description
    if "target_time" in body.model_fields_set:
        existing.targetTime = body.target_time
    if body.default_expected_minutes is not None:
        existing.defaultExpectedMinutes = body.default_expected_minutes
    if body.recurrence_days is not None:
        existing.recurrenceDays = body.recurrence_days
    if body.time_block_enabled is not None:
        existing.timeBlockEnabled = body.time_block_enabled
    if body.sort_order is not None:
        existing.sortOrder = body.sort_order
    if body.active is not None:
        existing.active = body.active
    if existing.timeBlockEnabled and (not existing.targetTime or existing.defaultExpectedMinutes <= 0):
        raise HTTPException(status_code=422, detail="Time blocking requires a target time and duration")
    db.flush()
    synchronize_habit_routine_block(db, existing)
    db.flush()
    return {"habit": serialize_habit(existing)}


@router.delete("")
def delete_habit(
    id: str | None = Query(default=None),
    date: str | None = Query(default=None),
    kind: str = Query(default="habit"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing habit id")
    if kind == "template":
        template = db.execute(
            select(HabitTemplate).where(HabitTemplate.id == id, HabitTemplate.userId == user.id)
        ).scalar_one_or_none()
        if template is None:
            raise HTTPException(status_code=404, detail="Habit template not found")
        db.delete(template)
        db.flush()
        return {"ok": True}
    existing = db.execute(
        select(Habit).where(Habit.id == id, Habit.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    db.execute(
        update(RoutineBlock)
        .where(RoutineBlock.userId == user.id, RoutineBlock.habitId == existing.id)
        .values(active=False)
    )
    existing.active = False
    db.flush()
    return get_habit_tracker_data(db, user.id, date or to_date_key())
