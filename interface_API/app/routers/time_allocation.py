from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..contracts.time_allocation import (
    TimeAllocationCategoryCreateRequest,
    TimeAllocationUpdateRequest,
)
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


def _update_category(
    category: TimeAllocationCategory,
    body: TimeAllocationUpdateRequest,
) -> None:
    if body.name is not None:
        category.name = body.name
    if body.objective is not None:
        category.objective = body.objective
    if body.color is not None:
        category.color = body.color
    if body.target_weight is not None:
        category.targetWeight = body.target_weight
    if body.expected_return is not None:
        category.expectedReturn = body.expected_return
    if body.risk is not None:
        category.risk = body.risk
    if body.beta is not None:
        category.beta = body.beta
    if body.active is not None:
        category.active = body.active


@router.get("")
def get_time_allocation(
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_time_allocation_data(db, user.id, date or to_date_key())


@router.post("")
def create_category(
    body: TimeAllocationCategoryCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = TimeAllocationCategory(
        userId=user.id,
        name=body.name or "New allocation",
        objective=body.objective,
        targetWeight=body.target_weight,
        expectedReturn=body.expected_return,
        risk=body.risk,
        beta=body.beta,
        color=body.color or "#22d3ee",
    )
    db.add(category)
    db.flush()
    return {"category": serialize_category(category)}


@router.patch("")
def update_time_allocation(
    body: TimeAllocationUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.kind == "day_budget":
        date_key = body.date.isoformat() if body.date else to_date_key()
        upsert_day_budget(
            db,
            user_id=user.id,
            date_key=date_key,
            day_budget_minutes=body.day_budget_minutes
            if body.day_budget_minutes is not None
            else 12 * 60,
        )
        return get_time_allocation_data(db, user.id, date_key)

    if body.kind == "allocation":
        date_key = body.date.isoformat() if body.date else to_date_key()
        category = db.execute(
            select(TimeAllocationCategory).where(
                TimeAllocationCategory.id == body.category_id,
                TimeAllocationCategory.userId == user.id,
            )
        ).scalar_one_or_none()
        if category is None:
            raise HTTPException(status_code=400, detail="Invalid categoryId")
        upsert_daily_allocation(
            db,
            user_id=user.id,
            date_key=date_key,
            category_id=body.category_id or "",
            planned_minutes=body.planned_minutes,
            planned_minutes_manual=body.planned_minutes_manual,
            actual_minutes=body.actual_minutes,
            note=body.note,
        )
        return get_time_allocation_data(db, user.id, date_key)

    if body.kind == "portfolio":
        date_key = body.date.isoformat() if body.date else to_date_key()
        if body.id:
            category = db.execute(
                select(TimeAllocationCategory).where(
                    TimeAllocationCategory.id == body.id,
                    TimeAllocationCategory.userId == user.id,
                )
            ).scalar_one_or_none()
            if category is None:
                raise HTTPException(status_code=404, detail="Allocation category not found")
            _update_category(category, body)
        else:
            category = TimeAllocationCategory(
                userId=user.id,
                name=body.name or "New allocation",
                objective=body.objective,
                targetWeight=body.target_weight or 0,
                expectedReturn=body.expected_return if body.expected_return is not None else 50,
                risk=body.risk if body.risk is not None else 50,
                beta=body.beta if body.beta is not None else 1,
                color=body.color or "#22d3ee",
            )
            db.add(category)
            db.flush()
        upsert_daily_allocation(
            db,
            user_id=user.id,
            date_key=date_key,
            category_id=category.id,
            planned_minutes=body.planned_minutes,
            planned_minutes_manual=body.planned_minutes_manual,
            actual_minutes=body.actual_minutes,
            note=body.note,
        )
        return get_time_allocation_data(db, user.id, date_key)

    existing = db.execute(
        select(TimeAllocationCategory).where(
            TimeAllocationCategory.id == body.id, TimeAllocationCategory.userId == user.id
        )
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Allocation category not found")
    _update_category(existing, body)
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
        raise HTTPException(status_code=400, detail="Missing category id")
    existing = db.execute(
        select(TimeAllocationCategory).where(
            TimeAllocationCategory.id == id, TimeAllocationCategory.userId == user.id
        )
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Allocation category not found")
    existing.active = False
    db.flush()
    return get_time_allocation_data(db, user.id, date or to_date_key())
