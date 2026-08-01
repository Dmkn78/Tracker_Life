from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..contracts.habits import HabitCreateRequest, HabitUpdateRequest
from ..database import get_db
from ..models import Habit, RoutineBlock, User
from ..security import get_current_user
from ..core.dates import iso_datetime, to_date_key
from ..core.habits import get_habit_tracker_data, upsert_habit_checkin

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
        "sortOrder": habit.sortOrder,
        "active": habit.active,
        "source": habit.source,
        "createdAt": iso_datetime(habit.createdAt),
        "updatedAt": iso_datetime(habit.updatedAt),
    }


@router.get("")
def get_habits(
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_habit_tracker_data(db, user.id, date or to_date_key())


@router.post("")
def create_habit(
    body: HabitCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    habit = Habit(
        userId=user.id,
        name=body.name or "New habit",
        category=body.category or "routine",
        description=body.description,
        targetTime=body.target_time,
        defaultExpectedMinutes=body.default_expected_minutes,
        sortOrder=body.sort_order,
        source="manual",
    )
    db.add(habit)
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
    if body.description is not None:
        existing.description = body.description
    if body.target_time is not None:
        existing.targetTime = body.target_time
    if body.default_expected_minutes is not None:
        existing.defaultExpectedMinutes = body.default_expected_minutes
    if body.sort_order is not None:
        existing.sortOrder = body.sort_order
    if body.active is not None:
        existing.active = body.active
    db.flush()
    return {"habit": serialize_habit(existing)}


@router.delete("")
def delete_habit(
    id: str | None = Query(default=None),
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing habit id")
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
