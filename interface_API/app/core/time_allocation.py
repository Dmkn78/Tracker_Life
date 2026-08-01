"""Time allocation portfolio logic (lib/timeAllocation.ts)."""

from __future__ import annotations

import math

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..models import DailyPlanningContext, DailyTimeAllocation, TimeAllocationCategory, utcnow
from .dates import add_days, get_iso_week_id, get_week_date_keys, parse_date_key, to_date_key
from .numbers import javascript_round


def _clamp(value: float, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, javascript_round(value)))


def _clamp_minutes(value: float) -> int:
    return max(0, javascript_round(value))


def allocate_minutes_from_weights(weights: list[float], total_minutes: int) -> list[int]:
    safe_total = _clamp_minutes(total_minutes)
    normalized = [max(0, weight) for weight in weights]
    weight_sum = sum(normalized)
    if safe_total == 0 or weight_sum == 0:
        return [0 for _ in normalized]

    raw = [weight / weight_sum * safe_total for weight in normalized]
    floors = [math.floor(value) for value in raw]
    remainder = safe_total - sum(floors)

    ranked = sorted(
        ((index, raw[index] - floors[index]) for index in range(len(raw))),
        key=lambda item: item[1],
        reverse=True,
    )
    for index, _fraction in ranked:
        if remainder <= 0:
            break
        floors[index] += 1
        remainder -= 1
    return floors


def compute_portfolio_metrics(rows: list[dict]) -> dict:
    target_return = sum(row["targetWeight"] / 100 * row["expectedReturn"] for row in rows)
    actual_return = sum(row["actualWeight"] / 100 * row["expectedReturn"] for row in rows)
    target_risk = math.sqrt(sum((row["targetWeight"] / 100) ** 2 * row["risk"] ** 2 for row in rows))
    actual_risk = math.sqrt(sum((row["actualWeight"] / 100) ** 2 * row["risk"] ** 2 for row in rows))
    beta = sum(row["actualWeight"] / 100 * row["beta"] for row in rows)
    risk_free = 20
    life_market_premium = 55
    capm_expected_return = risk_free + beta * life_market_premium

    return {
        "targetReturn": _clamp(target_return),
        "actualReturn": _clamp(actual_return),
        "targetRisk": _clamp(target_risk),
        "actualRisk": _clamp(actual_risk),
        "beta": round(beta, 2),
        "capmExpectedReturn": _clamp(capm_expected_return),
        "sharpeLike": 0 if actual_risk == 0 else round((actual_return - risk_free) / actual_risk, 2),
    }


def get_time_allocation_data(db: Session, user_id: str, date_key: str | None = None) -> dict:
    date_key = date_key or to_date_key()
    day = parse_date_key(date_key)
    week_days = get_week_date_keys(get_iso_week_id(date_key))

    categories = list(
        db.execute(
            select(TimeAllocationCategory)
            .where(TimeAllocationCategory.userId == user_id, TimeAllocationCategory.active.is_(True))
            .order_by(TimeAllocationCategory.createdAt.asc())
        ).scalars()
    )
    day_allocations = list(
        db.execute(
            select(DailyTimeAllocation).where(
                DailyTimeAllocation.userId == user_id, DailyTimeAllocation.date == day
            )
        ).scalars()
    )
    week_allocations = list(
        db.execute(
            select(DailyTimeAllocation).where(
                DailyTimeAllocation.userId == user_id,
                DailyTimeAllocation.date >= parse_date_key(week_days[0]),
                DailyTimeAllocation.date < parse_date_key(add_days(week_days[6], 1)),
            )
        ).scalars()
    )
    planning_context = db.execute(
        select(DailyPlanningContext).where(
            DailyPlanningContext.userId == user_id, DailyPlanningContext.date == day
        )
    ).scalar_one_or_none()

    day_by_category = {allocation.categoryId: allocation for allocation in day_allocations}
    week_by_category: dict[str, int] = {}
    for allocation in week_allocations:
        week_by_category[allocation.categoryId] = (
            week_by_category.get(allocation.categoryId, 0) + allocation.actualMinutes
        )
    day_total = sum(allocation.actualMinutes for allocation in day_allocations)
    week_total = sum(allocation.actualMinutes for allocation in week_allocations)
    day_budget_minutes = planning_context.dayBudgetMinutes if planning_context else 12 * 60
    auto_planned = allocate_minutes_from_weights(
        [category.targetWeight for category in categories], day_budget_minutes
    )

    rows = []
    for index, category in enumerate(categories):
        allocation = day_by_category.get(category.id)
        actual_minutes = allocation.actualMinutes if allocation else 0
        auto_planned_minutes = auto_planned[index] if index < len(auto_planned) else 0
        planned_minutes_manual = allocation.plannedMinutesManual if allocation else False
        planned_minutes_stored = allocation.plannedMinutes if allocation else 0
        planned_minutes = planned_minutes_stored if planned_minutes_manual else auto_planned_minutes
        actual_weight = (
            0 if day_total == 0 else javascript_round(actual_minutes / day_total * 100)
        )
        week_actual_minutes = week_by_category.get(category.id, 0)
        week_weight = (
            0
            if week_total == 0
            else javascript_round(week_actual_minutes / week_total * 100)
        )
        rows.append(
            {
                "id": category.id,
                "name": category.name,
                "objective": category.objective or "",
                "targetWeight": category.targetWeight,
                "actualWeight": actual_weight,
                "weekWeight": week_weight,
                "plannedMinutes": planned_minutes,
                "autoPlannedMinutes": auto_planned_minutes,
                "plannedMinutesStored": planned_minutes_stored,
                "plannedMinutesManual": planned_minutes_manual,
                "actualMinutes": actual_minutes,
                "weekActualMinutes": week_actual_minutes,
                "expectedReturn": category.expectedReturn,
                "risk": category.risk,
                "beta": category.beta,
                "color": category.color,
                "active": category.active,
            }
        )

    planned_minutes_total = sum(row["plannedMinutes"] for row in rows)
    planned_minutes_auto_total = sum(row["autoPlannedMinutes"] for row in rows)

    return {
        "date": date_key,
        "weekId": get_iso_week_id(date_key),
        "dayBudgetMinutes": day_budget_minutes,
        "targetWeightTotal": sum(row["targetWeight"] for row in rows),
        "plannedMinutesTotal": planned_minutes_total,
        "plannedMinutesAutoTotal": planned_minutes_auto_total,
        "actualMinutesTotal": day_total,
        "weekActualMinutesTotal": week_total,
        "remainingBudgetMinutes": max(0, day_budget_minutes - planned_minutes_total),
        "overBudgetMinutes": max(0, planned_minutes_total - day_budget_minutes),
        "hasManualPlanOverrides": any(row["plannedMinutesManual"] for row in rows),
        "rows": rows,
        "metrics": compute_portfolio_metrics(rows),
    }


def upsert_daily_allocation(
    db: Session,
    user_id: str,
    date_key: str,
    category_id: str,
    planned_minutes: int | None = None,
    planned_minutes_manual: bool | None = None,
    actual_minutes: int | None = None,
    note: str | None = None,
) -> DailyTimeAllocation:
    day = parse_date_key(date_key)
    insert_statement = insert(DailyTimeAllocation).values(
        userId=user_id,
        categoryId=category_id,
        date=day,
        plannedMinutes=_clamp_minutes(planned_minutes or 0),
        plannedMinutesManual=planned_minutes_manual or False,
        actualMinutes=actual_minutes or 0,
        note=note,
    )
    update_values: dict[str, object] = {"updatedAt": utcnow()}
    if planned_minutes is not None:
        update_values["plannedMinutes"] = _clamp_minutes(planned_minutes)
    if planned_minutes_manual is not None:
        update_values["plannedMinutesManual"] = planned_minutes_manual
    if actual_minutes is not None:
        update_values["actualMinutes"] = actual_minutes
    if note is not None:
        update_values["note"] = note
    upsert_statement = insert_statement.on_conflict_do_update(
        index_elements=[
            DailyTimeAllocation.userId,
            DailyTimeAllocation.categoryId,
            DailyTimeAllocation.date,
        ],
        set_=update_values,
    ).returning(DailyTimeAllocation)
    allocation = db.execute(upsert_statement).scalar_one()
    db.flush()
    return allocation


def upsert_day_budget(db: Session, user_id: str, date_key: str, day_budget_minutes: int) -> DailyPlanningContext:
    day = parse_date_key(date_key)
    insert_statement = insert(DailyPlanningContext).values(
        userId=user_id,
        date=day,
        dayBudgetMinutes=_clamp_minutes(day_budget_minutes),
    )
    upsert_statement = insert_statement.on_conflict_do_update(
        index_elements=[DailyPlanningContext.userId, DailyPlanningContext.date],
        set_={
            "dayBudgetMinutes": _clamp_minutes(day_budget_minutes),
            "updatedAt": utcnow(),
        },
    ).returning(DailyPlanningContext)
    planning_context = db.execute(upsert_statement).scalar_one()
    db.flush()
    return planning_context
