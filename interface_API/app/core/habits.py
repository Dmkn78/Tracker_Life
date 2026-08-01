"""Habit tracker data and check-in upserts (lib/habits.ts)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..models import Habit, HabitCheckin, RoutineBlock, utcnow
from .dates import add_days, parse_date_key, to_date_key
from .numbers import javascript_round


def get_habit_tracker_data(db: Session, user_id: str, date_key: str | None = None) -> dict:
    date_key = date_key or to_date_key()
    day = parse_date_key(date_key)
    habits = list(
        db.execute(
            select(Habit)
            .where(Habit.userId == user_id, Habit.active.is_(True))
            .order_by(Habit.sortOrder.asc(), Habit.createdAt.asc())
        ).scalars()
    )
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
                RoutineBlock.dayType == "school_day",
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

    checkin_by_habit = {checkin.habitId: checkin for checkin in checkins}
    completed_today = len([checkin for checkin in checkins if checkin.status == "done"])
    seven_day_possible = len(habits) * 7
    seven_day_done = len([checkin for checkin in recent_checkins if checkin.status == "done"])

    def habit_payload(habit: Habit) -> dict:
        checkin = checkin_by_habit.get(habit.id)
        return {
            "id": habit.id,
            "name": habit.name,
            "category": habit.category,
            "description": habit.description,
            "targetTime": habit.targetTime,
            "defaultExpectedMinutes": habit.defaultExpectedMinutes,
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
                "label": block.label,
                "startTime": block.startTime,
                "endTime": block.endTime,
                "sortOrder": block.sortOrder,
            }
            for block in routine_blocks
        ],
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
