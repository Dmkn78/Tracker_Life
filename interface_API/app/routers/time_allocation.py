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
from ..core.task_time_breakdown import get_task_time_breakdown
from ..core.time_allocation import (
    get_calendar_allocation_plans,
    get_time_allocation_data,
    upsert_daily_allocation,
    upsert_day_budget,
    upsert_period_budget,
    upsert_periodic_allocation,
)

router = APIRouter(prefix="/api/time-allocation", tags=["time-allocation"])


def _resolve_period_date(period: str, date_key: str | None) -> str:
    if date_key is None and period in ("week", "month"):
        raise ValueError("date is required for week and month periods")
    return date_key or to_date_key()


@router.get("/tasks")
def get_task_breakdown(
    period: str = Query(default="week"),
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if period not in ("week", "month"):
        raise HTTPException(status_code=400, detail="period must be 'week' or 'month'")
    return get_task_time_breakdown(db, user.id, period, date or to_date_key())


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
    period: str = Query(default="day"),
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if period not in ("day", "week", "month"):
        raise HTTPException(status_code=400, detail="period must be 'day', 'week', or 'month'")
    try:
        return get_time_allocation_data(db, user.id, _resolve_period_date(period, date), period)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/calendar")
def get_calendar_plans(
    from_date: str = Query(alias="from"),
    to_date: str = Query(alias="to"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return get_calendar_allocation_plans(db, user.id, from_date, to_date)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


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
    if body.kind in ("day_budget", "period_budget"):
        date_key = _resolve_period_date(body.period, body.date.isoformat() if body.date else None)
        try:
            if body.period == "day":
                upsert_day_budget(
                    db,
                    user_id=user.id,
                    date_key=date_key,
                    day_budget_minutes=body.day_budget_minutes
                    if body.day_budget_minutes is not None
                    else 12 * 60,
                )
            else:
                upsert_period_budget(
                    db,
                    user_id=user.id,
                    period=body.period,
                    date_key=date_key,
                    budget_minutes=body.period_budget_minutes or 0,
                )
            return get_time_allocation_data(db, user.id, date_key, body.period)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    if body.kind == "allocation":
        date_key = _resolve_period_date(body.period, body.date.isoformat() if body.date else None)
        category = db.execute(
            select(TimeAllocationCategory).where(
                TimeAllocationCategory.id == body.category_id,
                TimeAllocationCategory.userId == user.id,
            )
        ).scalar_one_or_none()
        if category is None:
            raise HTTPException(status_code=400, detail="Invalid categoryId")
        try:
            if body.period == "day":
                upsert_daily_allocation(
                    db, user.id, date_key, body.category_id or "", body.planned_minutes,
                    body.planned_minutes_manual, body.actual_minutes, body.note,
                )
            else:
                upsert_periodic_allocation(
                    db, user.id, body.period, date_key, body.category_id or "",
                    body.planned_minutes, body.planned_minutes_manual, body.note,
                )
            return get_time_allocation_data(db, user.id, date_key, body.period)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    if body.kind == "portfolio":
        date_key = _resolve_period_date(body.period, body.date.isoformat() if body.date else None)
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
        try:
            if body.period == "day":
                upsert_daily_allocation(
                    db, user.id, date_key, category.id, body.planned_minutes,
                    body.planned_minutes_manual, body.actual_minutes, body.note,
                )
            else:
                upsert_periodic_allocation(
                    db, user.id, body.period, date_key, category.id,
                    body.planned_minutes, body.planned_minutes_manual, body.note,
                )
            return get_time_allocation_data(db, user.id, date_key, body.period)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

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
    period: str = Query(default="day"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing category id")
    if period not in ("day", "week", "month"):
        raise HTTPException(status_code=400, detail="Invalid period")
    try:
        date_key = _resolve_period_date(period, date)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    existing = db.execute(
        select(TimeAllocationCategory).where(
            TimeAllocationCategory.id == id, TimeAllocationCategory.userId == user.id
        )
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Allocation category not found")
    existing.active = False
    db.flush()
    return get_time_allocation_data(db, user.id, date_key, period)
