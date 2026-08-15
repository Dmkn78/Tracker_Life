"""Habit tracker data and check-in upserts (lib/habits.ts)."""

from __future__ import annotations

from datetime import datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..models import Habit, HabitCheckin, HabitTemplate, RoutineBlock, utcnow
from .dates import add_days, parse_date_key, to_date_key
from .habit_schedule import end_time_for_duration, is_scheduled_on, normalize_recurrence_days, routine_occurrence_bounds
from .numbers import javascript_round


def get_habit_tracker_data(db: Session, user_id: str, date_key: str | None = None) -> dict:
    date_key = date_key or to_date_key()
    day = parse_date_key(date_key)
    all_habits = list(
        db.execute(
            select(Habit)
            .where(Habit.userId == user_id, Habit.active.is_(True))
            .order_by(Habit.sortOrder.asc(), Habit.createdAt.asc())
        ).scalars()
    )
    habits = [habit for habit in all_habits if is_scheduled_on(day, habit.recurrenceDays)]
    checkins = list(
        db.execute(
            select(HabitCheckin).where(HabitCheckin.userId == user_id, HabitCheckin.date == day)
        ).scalars()
    )
    routine_blocks = list(
        db.execute(
            select(RoutineBlock)
            .where(
                RoutineBlock.userId == user_id,
                RoutineBlock.active.is_(True),
            )
            .order_by(RoutineBlock.sortOrder.asc())
        ).scalars()
    )
    recent_checkins = list(
        db.execute(
            select(HabitCheckin)
            .where(
                HabitCheckin.userId == user_id,
                HabitCheckin.date >= parse_date_key(add_days(date_key, -6)),
                HabitCheckin.date <= day,
            )
            .order_by(HabitCheckin.date.asc())
        ).scalars()
    )

    routine_blocks = [block for block in routine_blocks if is_scheduled_on(day, block.recurrenceDays)]
    scheduled_habit_ids = {habit.id for habit in habits}
    checkin_by_habit = {checkin.habitId: checkin for checkin in checkins}
    completed_today = len([
        checkin for checkin in checkins
        if checkin.habitId in scheduled_habit_ids and checkin.status == "done"
    ])
    recent_start = parse_date_key(add_days(date_key, -6))
    seven_day_possible = sum(
        1
        for habit in all_habits
        for offset in range(7)
        if is_scheduled_on(recent_start + timedelta(days=offset), habit.recurrenceDays)
    )
    habit_by_id = {habit.id: habit for habit in all_habits}
    seven_day_done = len([
        checkin for checkin in recent_checkins
        if checkin.status == "done"
        and checkin.habitId in habit_by_id
        and is_scheduled_on(checkin.date, habit_by_id[checkin.habitId].recurrenceDays)
    ])

    def habit_payload(habit: Habit) -> dict:
        checkin = checkin_by_habit.get(habit.id)
        return {
            "id": habit.id,
            "name": habit.name,
            "category": habit.category,
            "description": habit.description,
            "targetTime": habit.targetTime,
            "defaultExpectedMinutes": habit.defaultExpectedMinutes,
            "recurrenceDays": habit.recurrenceDays,
            "timeBlockEnabled": habit.timeBlockEnabled,
            "sortOrder": habit.sortOrder,
            "source": habit.source,
            "checkin": (
                {
                    "id": checkin.id,
                    "status": checkin.status,
                    "actualMinutes": checkin.actualMinutes,
                    "note": checkin.note or "",
                }
                if checkin
                else {"id": None, "status": "planned", "actualMinutes": 0, "note": ""}
            ),
        }

    return {
        "date": date_key,
        "habits": [habit_payload(habit) for habit in habits],
        "routineBlocks": [
            {
                "id": block.id,
                "habitId": block.habitId,
                "dayType": block.dayType,
                "recurrenceDays": block.recurrenceDays,
                "label": block.label,
                "startTime": block.startTime,
                "endTime": block.endTime,
                "sortOrder": block.sortOrder,
            }
            for block in routine_blocks
        ],
        "templates": [serialize_habit_template(template) for template in list(
            db.execute(
                select(HabitTemplate)
                .where(HabitTemplate.userId == user_id)
                .order_by(HabitTemplate.createdAt.asc())
            ).scalars()
        )],
        "metrics": {
            "completedToday": completed_today,
            "totalToday": len(habits),
            "completionRateToday": 0
            if not habits
            else javascript_round(completed_today / len(habits) * 100),
            "sevenDayCompletionRate": (
                0
                if seven_day_possible == 0
                else javascript_round(seven_day_done / seven_day_possible * 100)
            ),
        },
    }


def serialize_habit_template(template: HabitTemplate) -> dict:
    return {
        "id": template.id,
        "name": template.name,
        "category": template.category,
        "description": template.description,
        "targetTime": template.targetTime,
        "defaultExpectedMinutes": template.defaultExpectedMinutes,
        "recurrenceDays": template.recurrenceDays,
        "timeBlockEnabled": template.timeBlockEnabled,
    }


def synchronize_habit_routine_block(db: Session, habit: Habit) -> None:
    blocks = list(
        db.execute(
            select(RoutineBlock)
            .where(RoutineBlock.userId == habit.userId, RoutineBlock.habitId == habit.id)
            .order_by(RoutineBlock.createdAt.asc())
        ).scalars()
    )
    should_enable = bool(
        habit.active
        and habit.timeBlockEnabled
        and habit.targetTime
        and habit.defaultExpectedMinutes > 0
    )
    if not should_enable:
        for block in blocks:
            block.active = False
        return

    block = blocks[0] if blocks else RoutineBlock(userId=habit.userId, habitId=habit.id)
    block.dayType = "recurring"
    block.recurrenceDays = normalize_recurrence_days(habit.recurrenceDays)
    block.label = habit.name
    block.startTime = habit.targetTime or "09:00"
    block.endTime = end_time_for_duration(block.startTime, habit.defaultExpectedMinutes)
    block.sortOrder = habit.sortOrder
    block.active = True
    if not blocks:
        db.add(block)
    for extra_block in blocks[1:]:
        extra_block.active = False


def get_calendar_routine_plans(db: Session, user_id: str, from_key: str, to_key: str) -> dict:
    range_start = parse_date_key(from_key)
    range_end = parse_date_key(to_key)
    if range_end < range_start:
        raise ValueError("to must be after from")
    if (range_end - range_start).days > 93:
        raise ValueError("routine calendar range cannot exceed 94 days")
    blocks = list(
        db.execute(
            select(RoutineBlock, Habit)
            .join(Habit, Habit.id == RoutineBlock.habitId)
            .where(
                RoutineBlock.userId == user_id,
                RoutineBlock.active.is_(True),
                Habit.userId == user_id,
                Habit.active.is_(True),
            )
            .order_by(RoutineBlock.sortOrder.asc())
        ).all()
    )
    occurrences = []
    range_start_at_midnight = datetime.combine(range_start, time.min)
    range_end_exclusive = datetime.combine(range_end + timedelta(days=1), time.min)
    day = range_start - timedelta(days=1)
    while day <= range_end:
        for block, habit in blocks:
            if not is_scheduled_on(day, block.recurrenceDays):
                continue
            start, end = routine_occurrence_bounds(day, block.startTime, block.endTime)
            if end <= range_start_at_midnight or start >= range_end_exclusive:
                continue
            occurrences.append({
                "id": f"{block.id}:{day.isoformat()}",
                "blockId": block.id,
                "habitId": habit.id,
                "title": block.label,
                "category": habit.category,
                "start": start.isoformat(),
                "end": end.isoformat(),
            })
        day += timedelta(days=1)
    return {"from": from_key, "to": to_key, "routines": occurrences}


def upsert_habit_checkin(
    db: Session,
    user_id: str,
    habit_id: str,
    date_key: str,
    status: str | None = None,
    actual_minutes: int | None = None,
    note: str | None = None,
) -> HabitCheckin:
    day = parse_date_key(date_key)
    insert_statement = insert(HabitCheckin).values(
        userId=user_id,
        habitId=habit_id,
        date=day,
        status=status or "planned",
        actualMinutes=actual_minutes or 0,
        note=note,
    )
    update_values: dict[str, object] = {"updatedAt": utcnow()}
    if status is not None:
        update_values["status"] = status
    if actual_minutes is not None:
        update_values["actualMinutes"] = actual_minutes
    if note is not None:
        update_values["note"] = note
    upsert_statement = insert_statement.on_conflict_do_update(
        index_elements=[HabitCheckin.userId, HabitCheckin.habitId, HabitCheckin.date],
        set_=update_values,
    ).returning(HabitCheckin)
    checkin = db.execute(upsert_statement).scalar_one()
    db.flush()
    return checkin
