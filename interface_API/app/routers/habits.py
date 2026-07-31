from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

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
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    habit = Habit(
        userId=user.id,
        name=body.get("name") or "New habit",
        category=body.get("category") or "routine",
        description=body.get("description"),
        targetTime=body.get("targetTime"),
        defaultExpectedMinutes=body.get("defaultExpectedMinutes") or 0,
        sortOrder=body.get("sortOrder") if body.get("sortOrder") is not None else 99,
        source="manual",
    )
    db.add(habit)
    db.flush()
    return {"habit": serialize_habit(habit)}


@router.patch("")
def update_habit(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.get("kind") == "checkin":
        date_key = body.get("date") or to_date_key()
        upsert_habit_checkin(
            db,
            user_id=user.id,
            habit_id=body["habitId"],
            date_key=date_key,
            status=body.get("status"),
            actual_minutes=body.get("actualMinutes"),
            note=body.get("note"),
        )
        return get_habit_tracker_data(db, user.id, date_key)

    existing = db.execute(
        select(Habit).where(Habit.id == body.get("id"), Habit.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Habit not found"}, status_code=404)
    for field in ("name", "category", "description", "targetTime"):
        if body.get(field) is not None:
            setattr(existing, field, body[field])
    if body.get("defaultExpectedMinutes") is not None:
        existing.defaultExpectedMinutes = body["defaultExpectedMinutes"]
    if body.get("sortOrder") is not None:
        existing.sortOrder = body["sortOrder"]
    if body.get("active") is not None:
        existing.active = body["active"]
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
        return JSONResponse({"error": "Missing habit id"}, status_code=400)
    existing = db.execute(
        select(Habit).where(Habit.id == id, Habit.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Habit not found"}, status_code=404)

    db.execute(
        update(RoutineBlock)
        .where(RoutineBlock.userId == user.id, RoutineBlock.habitId == existing.id)
        .values(active=False)
    )
    existing.active = False
    db.flush()
    return get_habit_tracker_data(db, user.id, date or to_date_key())
