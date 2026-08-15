"""Time allocation portfolio logic (lib/timeAllocation.ts)."""

from __future__ import annotations

import math
from datetime import timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..models import (
    DailyPlanningContext,
    DailyTimeAllocation,
    PeriodicTimeAllocation,
    TimeAllocationCategory,
    TimeAllocationPeriodContext,
    utcnow,
)
from .allocation_periods import (
    AllocationPeriod,
    allocation_period_range,
    default_budget_minutes,
    require_canonical_anchor,
)
from .dates import get_iso_week_id, parse_date_key, to_date_key
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


def aggregate_actual_minutes(
    allocations: list[DailyTimeAllocation],
    visible_category_ids: set[str] | None = None,
) -> tuple[dict[str, int], int]:
    by_category: dict[str, int] = {}
    for allocation in allocations:
        if visible_category_ids is not None and allocation.categoryId not in visible_category_ids:
            continue
        by_category[allocation.categoryId] = by_category.get(allocation.categoryId, 0) + allocation.actualMinutes
    return by_category, sum(by_category.values())


def build_effective_plans(categories: list, allocations: list, budget_minutes: int) -> list[dict]:
    """Resolve manual and automatic plans from one source of truth."""
    allocation_by_category = {allocation.categoryId: allocation for allocation in allocations}
    auto_minutes = allocate_minutes_from_weights(
        [category.targetWeight for category in categories], budget_minutes
    )
    effective_plans = []
    for index, category in enumerate(categories):
        allocation = allocation_by_category.get(category.id)
        planned_minutes_stored = allocation.plannedMinutes if allocation else 0
        planned_minutes_manual = allocation.plannedMinutesManual if allocation else False
        auto_planned_minutes = auto_minutes[index] if index < len(auto_minutes) else 0
        effective_plans.append({
            "category": category,
            "allocation": allocation,
            "plannedMinutes": planned_minutes_stored if planned_minutes_manual else auto_planned_minutes,
            "autoPlannedMinutes": auto_planned_minutes,
            "plannedMinutesStored": planned_minutes_stored,
            "plannedMinutesManual": planned_minutes_manual,
        })
    return effective_plans


def get_time_allocation_data(
    db: Session,
    user_id: str,
    date_key: str | None = None,
    period: AllocationPeriod = "day",
) -> dict:
    date_key = date_key or to_date_key()
    period_range = require_canonical_anchor(period, parse_date_key(date_key))

    categories = list(
        db.execute(
            select(TimeAllocationCategory)
            .where(TimeAllocationCategory.userId == user_id, TimeAllocationCategory.active.is_(True))
            .order_by(TimeAllocationCategory.createdAt.asc())
        ).scalars()
    )
    actual_allocations = list(
        db.execute(
            select(DailyTimeAllocation)
            .join(TimeAllocationCategory, TimeAllocationCategory.id == DailyTimeAllocation.categoryId)
            .where(
                DailyTimeAllocation.userId == user_id,
                DailyTimeAllocation.date >= period_range.start,
                DailyTimeAllocation.date < period_range.end_exclusive,
                TimeAllocationCategory.userId == user_id,
                TimeAllocationCategory.active.is_(True),
            )
        ).scalars()
    )
    week_range = allocation_period_range("week", period_range.anchor)
    week_allocations = list(
        db.execute(
            select(DailyTimeAllocation)
            .join(TimeAllocationCategory, TimeAllocationCategory.id == DailyTimeAllocation.categoryId)
            .where(
                DailyTimeAllocation.userId == user_id,
                DailyTimeAllocation.date >= week_range.start,
                DailyTimeAllocation.date < week_range.end_exclusive,
                TimeAllocationCategory.userId == user_id,
                TimeAllocationCategory.active.is_(True),
            )
        ).scalars()
    )
    if period == "day":
        planning_context = db.execute(
            select(DailyPlanningContext).where(
                DailyPlanningContext.userId == user_id,
                DailyPlanningContext.date == period_range.anchor,
            )
        ).scalar_one_or_none()
        plan_allocations = actual_allocations
        budget_minutes = planning_context.dayBudgetMinutes if planning_context else default_budget_minutes(period_range)
    else:
        planning_context = db.execute(
            select(TimeAllocationPeriodContext).where(
                TimeAllocationPeriodContext.userId == user_id,
                TimeAllocationPeriodContext.period == period.upper(),
                TimeAllocationPeriodContext.startDate == period_range.anchor,
            )
        ).scalar_one_or_none()
        plan_allocations = list(
            db.execute(
                select(PeriodicTimeAllocation).where(
                    PeriodicTimeAllocation.userId == user_id,
                    PeriodicTimeAllocation.period == period.upper(),
                    PeriodicTimeAllocation.startDate == period_range.anchor,
                )
            ).scalars()
        )
        budget_minutes = planning_context.budgetMinutes if planning_context else default_budget_minutes(period_range)

    visible_category_ids = {category.id for category in categories}
    actual_by_category, actual_total = aggregate_actual_minutes(actual_allocations, visible_category_ids)
    week_by_category, week_total = aggregate_actual_minutes(week_allocations, visible_category_ids)
    effective_plans = build_effective_plans(categories, plan_allocations, budget_minutes)

    rows = []
    for effective_plan in effective_plans:
        category = effective_plan["category"]
        actual_minutes = actual_by_category.get(category.id, 0)
        actual_weight = (
            0 if actual_total == 0 else javascript_round(actual_minutes / actual_total * 100)
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
                "plannedMinutes": effective_plan["plannedMinutes"],
                "autoPlannedMinutes": effective_plan["autoPlannedMinutes"],
                "plannedMinutesStored": effective_plan["plannedMinutesStored"],
                "plannedMinutesManual": effective_plan["plannedMinutesManual"],
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
        "date": period_range.anchor.isoformat(),
        "period": period,
        "rangeStart": period_range.start.isoformat(),
        "rangeEnd": period_range.end.isoformat(),
        "weekId": get_iso_week_id(period_range.anchor.isoformat()),
        "dayBudgetMinutes": budget_minutes,
        "periodBudgetMinutes": budget_minutes,
        "maximumBudgetMinutes": period_range.maximum_budget_minutes,
        "targetWeightTotal": sum(row["targetWeight"] for row in rows),
        "plannedMinutesTotal": planned_minutes_total,
        "plannedMinutesAutoTotal": planned_minutes_auto_total,
        "actualMinutesTotal": actual_total,
        "weekActualMinutesTotal": week_total,
        "remainingBudgetMinutes": max(0, budget_minutes - planned_minutes_total),
        "overBudgetMinutes": max(0, planned_minutes_total - budget_minutes),
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


def upsert_period_budget(
    db: Session,
    user_id: str,
    period: Literal["week", "month"],
    date_key: str,
    budget_minutes: int,
) -> TimeAllocationPeriodContext:
    period_range = require_canonical_anchor(period, parse_date_key(date_key))
    insert_statement = insert(TimeAllocationPeriodContext).values(
        userId=user_id,
        period=period.upper(),
        startDate=period_range.anchor,
        budgetMinutes=_clamp_minutes(budget_minutes),
    )
    statement = insert_statement.on_conflict_do_update(
        index_elements=[
            TimeAllocationPeriodContext.userId,
            TimeAllocationPeriodContext.period,
            TimeAllocationPeriodContext.startDate,
        ],
        set_={"budgetMinutes": _clamp_minutes(budget_minutes), "updatedAt": utcnow()},
    ).returning(TimeAllocationPeriodContext)
    context = db.execute(statement).scalar_one()
    db.flush()
    return context


def upsert_periodic_allocation(
    db: Session,
    user_id: str,
    period: Literal["week", "month"],
    date_key: str,
    category_id: str,
    planned_minutes: int | None = None,
    planned_minutes_manual: bool | None = None,
    note: str | None = None,
) -> PeriodicTimeAllocation:
    period_range = require_canonical_anchor(period, parse_date_key(date_key))
    insert_statement = insert(PeriodicTimeAllocation).values(
        userId=user_id,
        categoryId=category_id,
        period=period.upper(),
        startDate=period_range.anchor,
        plannedMinutes=_clamp_minutes(planned_minutes or 0),
        plannedMinutesManual=planned_minutes_manual or False,
        note=note,
    )
    update_values: dict[str, object] = {"updatedAt": utcnow()}
    if planned_minutes is not None:
        update_values["plannedMinutes"] = _clamp_minutes(planned_minutes)
    if planned_minutes_manual is not None:
        update_values["plannedMinutesManual"] = planned_minutes_manual
    if note is not None:
        update_values["note"] = note
    statement = insert_statement.on_conflict_do_update(
        index_elements=[
            PeriodicTimeAllocation.userId,
            PeriodicTimeAllocation.categoryId,
            PeriodicTimeAllocation.period,
            PeriodicTimeAllocation.startDate,
        ],
        set_=update_values,
    ).returning(PeriodicTimeAllocation)
    allocation = db.execute(statement).scalar_one()
    db.flush()
    return allocation


def get_calendar_allocation_plans(db: Session, user_id: str, range_start: str, range_end: str) -> dict:
    start = parse_date_key(range_start)
    end_inclusive = parse_date_key(range_end)
    if end_inclusive < start:
        raise ValueError("to must be after from")
    end = end_inclusive + timedelta(days=1)
    categories = list(
        db.execute(
            select(TimeAllocationCategory)
            .where(TimeAllocationCategory.userId == user_id, TimeAllocationCategory.active.is_(True))
            .order_by(TimeAllocationCategory.createdAt.asc())
        ).scalars()
    )
    contexts = list(
        db.execute(
            select(TimeAllocationPeriodContext).where(
                TimeAllocationPeriodContext.userId == user_id,
                TimeAllocationPeriodContext.startDate < end,
            )
        ).scalars()
    )
    allocations = list(
        db.execute(
            select(PeriodicTimeAllocation).where(
                PeriodicTimeAllocation.userId == user_id,
                PeriodicTimeAllocation.startDate < end,
            )
            .order_by(PeriodicTimeAllocation.startDate.asc())
        ).scalars()
    )
    contexts_by_period = {(context.period, context.startDate): context for context in contexts}
    allocations_by_period: dict[tuple[str, object], list[PeriodicTimeAllocation]] = {}
    for allocation in allocations:
        allocations_by_period.setdefault((allocation.period, allocation.startDate), []).append(allocation)
    persisted_periods = set(contexts_by_period) | set(allocations_by_period)
    plans = []
    for period_name, period_start in sorted(persisted_periods, key=lambda item: (item[1], item[0])):
        period = period_name.lower()
        period_range = allocation_period_range(period, period_start)
        if period_range.end_exclusive <= start:
            continue
        context = contexts_by_period.get((period_name, period_start))
        budget_minutes = context.budgetMinutes if context else default_budget_minutes(period_range)
        effective_plans = build_effective_plans(
            categories,
            allocations_by_period.get((period_name, period_start), []),
            budget_minutes,
        )
        for effective_plan in effective_plans:
            category = effective_plan["category"]
            plans.append({
                "id": f"{period}-{period_start.isoformat()}-{category.id}",
                "categoryId": category.id,
                "title": category.name,
                "color": category.color,
                "period": period,
                "startDate": period_range.start.isoformat(),
                "endDate": period_range.end.isoformat(),
                "endExclusive": period_range.end_exclusive.isoformat(),
                "plannedMinutes": effective_plan["plannedMinutes"],
                "plannedMinutesManual": effective_plan["plannedMinutesManual"],
            })
    return {"from": range_start, "to": range_end, "plans": plans}
