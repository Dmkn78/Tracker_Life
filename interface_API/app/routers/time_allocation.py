from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TimeAllocationCategory, User
from ..security import get_current_user
from ..core.dates import iso_datetime, to_date_key
from ..core.time_allocation import (
    get_time_allocation_data,
    upsert_daily_allocation,
    upsert_day_budget,
)

router = APIRouter(prefix="/api/time-allocation", tags=["time-allocation"])


def serialize_category(category: TimeAllocationCategory) -> dict:
    return {
        "id": category.id,
        "userId": category.userId,
        "name": category.name,
        "objective": category.objective,
        "targetWeight": category.targetWeight,
        "expectedReturn": category.expectedReturn,
        "risk": category.risk,
        "beta": category.beta,
        "color": category.color,
        "active": category.active,
        "createdAt": iso_datetime(category.createdAt),
        "updatedAt": iso_datetime(category.updatedAt),
    }


@router.get("")
def get_time_allocation(
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_time_allocation_data(db, user.id, date or to_date_key())


@router.post("")
def create_category(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = TimeAllocationCategory(
        userId=user.id,
        name=body.get("name") or "New allocation",
        objective=body.get("objective"),
        targetWeight=body.get("targetWeight") if body.get("targetWeight") is not None else 0,
        expectedReturn=body.get("expectedReturn") if body.get("expectedReturn") is not None else 50,
        risk=body.get("risk") if body.get("risk") is not None else 50,
        beta=body.get("beta") if body.get("beta") is not None else 1,
        color=body.get("color") or "#22d3ee",
    )
    db.add(category)
    db.flush()
    return {"category": serialize_category(category)}


@router.patch("")
def update_time_allocation(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.get("kind") == "day_budget":
        date_key = body.get("date") or to_date_key()
        upsert_day_budget(
            db,
            user_id=user.id,
            date_key=date_key,
            day_budget_minutes=body.get("dayBudgetMinutes")
            if body.get("dayBudgetMinutes") is not None
            else 12 * 60,
        )
        return get_time_allocation_data(db, user.id, date_key)

    if body.get("kind") == "allocation":
        date_key = body.get("date") or to_date_key()
        upsert_daily_allocation(
            db,
            user_id=user.id,
            date_key=date_key,
            category_id=body["categoryId"],
            planned_minutes=body.get("plannedMinutes"),
            planned_minutes_manual=body.get("plannedMinutesManual"),
            actual_minutes=body.get("actualMinutes"),
            note=body.get("note"),
        )
        return get_time_allocation_data(db, user.id, date_key)

    existing = db.execute(
        select(TimeAllocationCategory).where(
            TimeAllocationCategory.id == body.get("id"), TimeAllocationCategory.userId == user.id
        )
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Allocation category not found"}, status_code=404)
    for field in ("name", "objective", "color"):
        if body.get(field) is not None:
            setattr(existing, field, body[field])
    for field in ("targetWeight", "expectedReturn", "risk", "beta"):
        if body.get(field) is not None:
            setattr(existing, field, body[field])
    if body.get("active") is not None:
        existing.active = body["active"]
    db.flush()
    return {"category": serialize_category(existing)}


@router.delete("")
def delete_category(
    id: str | None = Query(default=None),
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        return JSONResponse({"error": "Missing category id"}, status_code=400)
    existing = db.execute(
        select(TimeAllocationCategory).where(
            TimeAllocationCategory.id == id, TimeAllocationCategory.userId == user.id
        )
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Allocation category not found"}, status_code=404)
    existing.active = False
    db.flush()
    return get_time_allocation_data(db, user.id, date or to_date_key())
