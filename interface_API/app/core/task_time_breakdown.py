"""Task-derived time breakdown (by tag / by company) for week and month periods.

Reuses `Task.estimatedMinutes` as the single source of truth for "time spent
on a task" — no separate ledger. Unrelated to the `TimeAllocationCategory`
portfolio system in `time_allocation.py`.
"""

from __future__ import annotations

import calendar
from datetime import date as Date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Company, Task, Tag, TaskTag
from .dates import get_iso_week_id, get_week_date_keys, parse_date_key, to_date_key


def _month_range(date_key: str) -> tuple[str, str]:
    day = parse_date_key(date_key)
    last_day = calendar.monthrange(day.year, day.month)[1]
    start = Date(day.year, day.month, 1)
    end = Date(day.year, day.month, last_day)
    return start.isoformat(), end.isoformat()


def _week_range(date_key: str) -> tuple[str, str]:
    week_days = get_week_date_keys(get_iso_week_id(date_key))
    return week_days[0], week_days[-1]


def get_task_time_breakdown(db: Session, user_id: str, period: str, date_key: str | None = None) -> dict:
    date_key = date_key or to_date_key()
    range_start, range_end = _month_range(date_key) if period == "month" else _week_range(date_key)

    tasks = list(
        db.execute(
            select(Task).where(
                Task.userId == user_id,
                Task.date >= parse_date_key(range_start),
                Task.date <= parse_date_key(range_end),
            )
        ).scalars()
    )

    total_minutes = sum(task.estimatedMinutes for task in tasks)

    company_ids = {task.companyId for task in tasks if task.companyId}
    companies_by_id = {
        company.id: company
        for company in db.execute(select(Company).where(Company.id.in_(company_ids))).scalars()
    } if company_ids else {}
    company_minutes: dict[str, int] = {}
    no_company_minutes = 0
    for task in tasks:
        if task.companyId:
            company_minutes[task.companyId] = company_minutes.get(task.companyId, 0) + task.estimatedMinutes
        else:
            no_company_minutes += task.estimatedMinutes

    task_ids = [task.id for task in tasks]
    tag_rows = list(
        db.execute(
            select(TaskTag.taskId, Tag).join(Tag, Tag.id == TaskTag.tagId).where(TaskTag.taskId.in_(task_ids))
        ).all()
    ) if task_ids else []
    minutes_by_task = {task.id: task.estimatedMinutes for task in tasks}
    tag_minutes: dict[str, int] = {}
    tags_by_id: dict[str, Tag] = {}
    tagged_task_ids: set[str] = set()
    for task_id, tag in tag_rows:
        tags_by_id[tag.id] = tag
        tag_minutes[tag.id] = tag_minutes.get(tag.id, 0) + minutes_by_task.get(task_id, 0)
        tagged_task_ids.add(task_id)
    untagged_minutes = sum(minutes for task_id, minutes in minutes_by_task.items() if task_id not in tagged_task_ids)

    return {
        "period": period,
        "rangeStart": range_start,
        "rangeEnd": range_end,
        "totalMinutes": total_minutes,
        "taskCount": len(tasks),
        "byCompany": sorted(
            (
                {
                    "companyId": company_id,
                    "name": companies_by_id[company_id].name,
                    "color": companies_by_id[company_id].color,
                    "minutes": minutes,
                }
                for company_id, minutes in company_minutes.items()
                if company_id in companies_by_id
            ),
            key=lambda row: row["minutes"],
            reverse=True,
        ),
        "noCompanyMinutes": no_company_minutes,
        "byTag": sorted(
            (
                {
                    "tagId": tag_id,
                    "name": tags_by_id[tag_id].name,
                    "color": tags_by_id[tag_id].color,
                    "minutes": minutes,
                }
                for tag_id, minutes in tag_minutes.items()
            ),
            key=lambda row: row["minutes"],
            reverse=True,
        ),
        "untaggedMinutes": untagged_minutes,
    }
