"""Objectives tree, weekly planning blocks and stats (lib/objectives.ts)."""

from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..models import CalendarEvent, Objective, Task, WeeklyPlanBlock
from .dates import (
    add_days,
    day_full_label,
    day_label,
    event_time_label,
    get_iso_week_id,
    get_week_date_keys,
    iso_datetime,
    month_year_label,
    parse_date_key,
)

PRIORITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
HORIZON_RANK = {"YEAR": 1, "QUARTER": 2, "MONTH": 3, "WEEK": 4}


def format_minutes(total_minutes: float) -> str:
    minutes = max(0, round(total_minutes))
    if minutes == 0:
        return "0m"
    days, after_days = divmod(minutes, 60 * 24)
    hours, rest = divmod(after_days, 60)
    parts = [f"{days}d" if days else "", f"{hours}h" if hours else "", f"{rest}m" if rest else ""]
    return " ".join(part for part in parts if part)


def serialize_objective(objective: Objective) -> dict:
    return {
        "id": objective.id,
        "parentId": objective.parentId,
        "title": objective.title,
        "summary": objective.summary,
        "nextAction": objective.nextAction,
        "kind": objective.kind.lower(),
        "horizon": objective.horizon.lower(),
        "status": objective.status.lower(),
        "priority": objective.priority.lower(),
        "targetDate": objective.targetDate.isoformat() if objective.targetDate else None,
        "weekId": objective.weekId,
        "color": objective.color,
        "sortOrder": objective.sortOrder,
        "archived": objective.archived,
        "createdAt": iso_datetime(objective.createdAt),
        "updatedAt": iso_datetime(objective.updatedAt),
    }


def serialize_task(task: Task, objective_title: str | None = None) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "date": task.date.isoformat(),
        "status": task.status.lower(),
        "importance": task.importance.lower(),
        "completionPercent": task.completionPercent,
        "estimatedMinutes": task.estimatedMinutes,
        "objectiveId": task.objectiveId,
        "objectiveTitle": objective_title,
    }


def serialize_block(block: WeeklyPlanBlock, objective: Objective | None = None) -> dict:
    return {
        "id": block.id,
        "title": block.title,
        "date": block.date.isoformat(),
        "category": block.category.lower(),
        "startTime": block.startTime,
        "endTime": block.endTime,
        "durationMinutes": block.durationMinutes,
        "flexible": block.flexible,
        "note": block.note,
        "objectiveId": block.objectiveId,
        "objectiveTitle": objective.title if objective else None,
        "objectiveColor": objective.color if objective else None,
        "createdAt": iso_datetime(block.createdAt),
        "updatedAt": iso_datetime(block.updatedAt),
    }


def serialize_event(event: CalendarEvent) -> dict:
    return {
        "id": event.id,
        "title": event.title,
        "impact": event.impact.lower(),
        "type": event.type.lower(),
        "start": iso_datetime(event.start),
        "end": iso_datetime(event.end),
        "timeLabel": f"{event_time_label(event.start)}-{event_time_label(event.end)}",
    }


def default_objective_title(kind: str | None) -> str:
    kind = (kind or "").lower()
    if kind == "project":
        return "New project"
    if kind == "milestone":
        return "New milestone"
    return "New objective"


def sync_objective_tasks(db: Session, user_id: str, objective_id: str, linked_task_ids: list[str]) -> None:
    unique_ids = list(dict.fromkeys(task_id for task_id in linked_task_ids if task_id))
    unlink = update(Task).where(Task.userId == user_id, Task.objectiveId == objective_id)
    if unique_ids:
        unlink = unlink.where(Task.id.not_in(unique_ids))
    db.execute(unlink.values(objectiveId=None))
    if unique_ids:
        db.execute(
            update(Task)
            .where(Task.userId == user_id, Task.id.in_(unique_ids))
            .values(objectiveId=objective_id)
        )
    db.flush()


def _objective_sort_key(objective: Objective) -> tuple:
    return (
        HORIZON_RANK[objective.horizon],
        -PRIORITY_RANK[objective.priority],
        objective.sortOrder,
    )


def get_objectives_data(db: Session, user_id: str, week_id: str | None = None) -> dict:
    week_id = week_id or get_iso_week_id()
    week_days = get_week_date_keys(week_id)
    week_start, week_end = week_days[0], week_days[6]
    task_from = add_days(week_start, -14)
    task_to = add_days(week_end, 30)

    objectives = list(
        db.execute(
            select(Objective)
            .where(Objective.userId == user_id, Objective.archived.is_(False))
            .order_by(Objective.sortOrder.asc(), Objective.createdAt.asc())
        ).scalars()
    )
    tasks = list(
        db.execute(
            select(Task)
            .where(
                Task.userId == user_id,
                Task.date >= parse_date_key(task_from),
                Task.date <= parse_date_key(task_to),
            )
            .order_by(Task.date.asc(), Task.importance.desc(), Task.createdAt.asc())
        ).scalars()
    )
    block_rows = list(
        db.execute(
            select(WeeklyPlanBlock)
            .where(
                WeeklyPlanBlock.userId == user_id,
                WeeklyPlanBlock.date >= parse_date_key(week_start),
                WeeklyPlanBlock.date <= parse_date_key(week_end),
            )
            .order_by(WeeklyPlanBlock.date.asc(), WeeklyPlanBlock.startTime.asc(), WeeklyPlanBlock.createdAt.asc())
        ).scalars()
    )
    from datetime import datetime, time

    week_events = list(
        db.execute(
            select(CalendarEvent)
            .where(
                CalendarEvent.userId == user_id,
                CalendarEvent.start >= datetime.combine(parse_date_key(week_start), time.min),
                CalendarEvent.start < datetime.combine(parse_date_key(add_days(week_end, 1)), time.min),
            )
            .order_by(CalendarEvent.start.asc())
        ).scalars()
    )

    objective_map = {objective.id: objective for objective in objectives}
    task_options = [
        serialize_task(
            task,
            objective_map[task.objectiveId].title
            if task.objectiveId and task.objectiveId in objective_map
            else None,
        )
        for task in tasks
        if task.status != "CANCELLED"
    ]
    tasks_by_objective: dict[str, list[dict]] = {}
    for task in task_options:
        if not task["objectiveId"]:
            continue
        tasks_by_objective.setdefault(task["objectiveId"], []).append(task)

    block_options = [
        serialize_block(block, objective_map.get(block.objectiveId) if block.objectiveId else None)
        for block in block_rows
    ]
    blocks_by_objective: dict[str, list[dict]] = {}
    for block in block_options:
        if not block["objectiveId"]:
            continue
        blocks_by_objective.setdefault(block["objectiveId"], []).append(block)

    children_by_parent: dict[str | None, list[Objective]] = {}
    for objective in objectives:
        children_by_parent.setdefault(objective.parentId, []).append(objective)

    def build_node(objective_id: str, trail: frozenset[str] = frozenset()) -> dict | None:
        objective = objective_map.get(objective_id)
        if objective is None or objective_id in trail:
            return None
        next_trail = trail | {objective_id}
        children = [
            node
            for child in sorted(children_by_parent.get(objective.id, []), key=_objective_sort_key)
            if (node := build_node(child.id, next_trail)) is not None
        ]
        linked_tasks = tasks_by_objective.get(objective.id, [])
        planned_blocks = blocks_by_objective.get(objective.id, [])
        if objective.status == "DONE":
            completion = 100
        elif linked_tasks:
            completion = round(sum(task["completionPercent"] for task in linked_tasks) / len(linked_tasks))
        else:
            completion = 0
        return {
            **serialize_objective(objective),
            "completionPercent": completion,
            "linkedTasksCount": len(linked_tasks),
            "linkedTasks": linked_tasks[:4],
            "weeklyMinutes": sum(block["durationMinutes"] for block in planned_blocks),
            "weeklyBlocksCount": len(planned_blocks),
            "children": children,
        }

    tree = [
        node
        for objective in sorted(children_by_parent.get(None, []), key=_objective_sort_key)
        if (node := build_node(objective.id)) is not None
    ]

    serialized_events = [serialize_event(event) for event in week_events]
    weekly_days = []
    for index, date_key in enumerate(week_days):
        blocks = [block for block in block_options if block["date"] == date_key]
        events = [event for event in serialized_events if event["start"][:10] == date_key]
        total_minutes = sum(block["durationMinutes"] for block in blocks)
        weekly_days.append(
            {
                "date": date_key,
                "label": day_label(date_key),
                "fullLabel": day_full_label(date_key),
                "isWeekend": index >= 5,
                "totalMinutes": total_minutes,
                "loadLabel": format_minutes(total_minutes),
                "blocks": blocks,
                "events": events,
            }
        )

    allocation_map: dict[str, dict] = {}
    for block in block_options:
        key = block["objectiveId"] or f"unlinked:{block['category']}"
        current = allocation_map.setdefault(
            key,
            {
                "key": key,
                "objectiveId": block["objectiveId"],
                "title": block["objectiveTitle"] or block["title"],
                "color": block["objectiveColor"] or "#8da2fb",
                "minutes": 0,
                "days": set(),
                "blocks": 0,
            },
        )
        current["minutes"] += block["durationMinutes"]
        current["days"].add(block["date"])
        current["blocks"] += 1

    allocation = sorted(
        (
            {
                "key": item["key"],
                "objectiveId": item["objectiveId"],
                "title": item["title"],
                "color": item["color"],
                "minutes": item["minutes"],
                "minutesLabel": format_minutes(item["minutes"]),
                "daysWorked": sorted(item["days"]),
                "dayCount": len(item["days"]),
                "blocks": item["blocks"],
            }
            for item in allocation_map.values()
        ),
        key=lambda item: item["minutes"],
        reverse=True,
    )

    day_loads = [
        {
            "date": day["date"],
            "label": day["label"],
            "totalMinutes": day["totalMinutes"],
            "loadLabel": day["loadLabel"],
            "blockCount": len(day["blocks"]),
            "eventCount": len(day["events"]),
            "isWeekend": day["isWeekend"],
        }
        for day in weekly_days
    ]
    total_weekly_minutes = sum(day["totalMinutes"] for day in day_loads)
    busiest_day = max(day_loads, key=lambda day: day["totalMinutes"], default=None)
    lightest_day = min(day_loads, key=lambda day: day["totalMinutes"], default=None)
    imbalance_minutes = max(
        0, (busiest_day["totalMinutes"] if busiest_day else 0) - (lightest_day["totalMinutes"] if lightest_day else 0)
    )
    active_objectives = len(
        [objective for objective in objectives if objective.status != "DONE" and not objective.archived]
    )
    project_count = len([objective for objective in objectives if objective.kind == "PROJECT"])
    horizon_coverage = len({objective.horizon for objective in objectives})

    next_actions = [
        {
            "id": objective.id,
            "title": objective.title,
            "nextAction": objective.nextAction or "Define the next concrete move.",
            "horizon": objective.horizon.lower(),
            "priority": objective.priority.lower(),
            "status": objective.status.lower(),
            "linkedTasksCount": len(tasks_by_objective.get(objective.id, [])),
            "weeklyMinutes": sum(
                block["durationMinutes"] for block in blocks_by_objective.get(objective.id, [])
            ),
        }
        for objective in sorted(
            [objective for objective in objectives if objective.status != "DONE"],
            key=lambda objective: (-PRIORITY_RANK[objective.priority], HORIZON_RANK[objective.horizon]),
        )[:6]
    ]

    def with_date_label(day: dict | None) -> dict | None:
        return {**day, "dateLabel": day_full_label(day["date"])} if day else None

    return {
        "weekId": week_id,
        "weekDays": week_days,
        "tree": tree,
        "objectives": [
            {
                **serialize_objective(objective),
                "linkedTaskIds": [task["id"] for task in tasks_by_objective.get(objective.id, [])],
                "linkedTasksCount": len(tasks_by_objective.get(objective.id, [])),
                "weeklyMinutes": sum(
                    block["durationMinutes"] for block in blocks_by_objective.get(objective.id, [])
                ),
            }
            for objective in objectives
        ],
        "taskOptions": task_options,
        "weeklyBlocks": block_options,
        "weeklyDays": weekly_days,
        "allocation": allocation,
        "nextActions": next_actions,
        "stats": {
            "roots": len(tree),
            "activeObjectives": active_objectives,
            "projectCount": project_count,
            "horizonCoverage": horizon_coverage,
            "totalWeeklyMinutes": total_weekly_minutes,
            "totalWeeklyMinutesLabel": format_minutes(total_weekly_minutes),
            "busiestDay": with_date_label(busiest_day),
            "imbalanceMinutes": imbalance_minutes,
            "imbalanceLabel": format_minutes(imbalance_minutes),
            "highLoadDays": len([day for day in day_loads if day["totalMinutes"] >= 300]),
            "linkedTasks": len([task for task in task_options if task["objectiveId"]]),
        },
        "weekSummary": {
            "totalMinutes": total_weekly_minutes,
            "totalMinutesLabel": format_minutes(total_weekly_minutes),
            "busiestDay": with_date_label(busiest_day),
            "lightestDay": with_date_label(lightest_day),
            "imbalanceMinutes": imbalance_minutes,
            "imbalanceLabel": format_minutes(imbalance_minutes),
            "dayLoads": day_loads,
        },
        "suggestedTemplates": [
            {
                "title": "Annual direction",
                "horizon": "year",
                "kind": "objective",
                "summary": "The highest-level direction you want the rest of the tree to serve.",
            },
            {
                "title": "Quarter focus",
                "horizon": "quarter",
                "kind": "objective",
                "summary": "A quarter-level bet that narrows the year into one strategic focus.",
            },
            {
                "title": "Weekly project",
                "horizon": "week",
                "kind": "project",
                "summary": "A week-level project connected to concrete blocks and tasks.",
            },
        ],
    }


def bootstrap_objectives_demo(db: Session, user_id: str, week_id: str | None = None) -> dict:
    week_id = week_id or get_iso_week_id()
    existing = db.execute(
        select(func.count())
        .select_from(Objective)
        .where(Objective.userId == user_id, Objective.archived.is_(False))
    ).scalar_one()
    if existing > 0:
        return get_objectives_data(db, user_id, week_id)

    week_days = get_week_date_keys(week_id)
    current_year = week_days[0][:4]
    quarter = (int(week_days[0][5:7]) - 1) // 3 + 1
    month_label = month_year_label(week_days[0])

    year_objective = Objective(
        userId=user_id,
        title=f"{current_year} Direction",
        summary="The big direction that defines what matters this year.",
        nextAction="Clarify the one outcome that would make this year feel successful.",
        kind="OBJECTIVE",
        horizon="YEAR",
        status="ACTIVE",
        priority="HIGH",
        targetDate=parse_date_key(f"{current_year}-12-31"),
        color="#8da2fb",
    )
    db.add(year_objective)
    db.flush()

    quarter_objective = Objective(
        userId=user_id,
        parentId=year_objective.id,
        title=f"Q{quarter} focus",
        summary="One quarter focus that turns the yearly direction into an actual project.",
        nextAction="Choose the project that deserves the most energy this quarter.",
        kind="OBJECTIVE",
        horizon="QUARTER",
        status="ACTIVE",
        priority="HIGH",
        color="#6aa8ff",
    )
    db.add(quarter_objective)
    db.flush()

    month_objective = Objective(
        userId=user_id,
        parentId=quarter_objective.id,
        title=month_label,
        summary="Concrete monthly objective.",
        nextAction="Define the deliverable you want finished by month end.",
        kind="OBJECTIVE",
        horizon="MONTH",
        status="ON_TRACK",
        priority="MEDIUM",
        targetDate=parse_date_key(add_days(week_days[0], 20)),
        color="#57c59a",
    )
    db.add(month_objective)
    db.flush()

    week_objective = Objective(
        userId=user_id,
        parentId=month_objective.id,
        title=f"Week {week_id}",
        summary="The weekly focus that deserves committed blocks on the calendar.",
        nextAction="Protect two high-quality work blocks and one review block.",
        kind="OBJECTIVE",
        horizon="WEEK",
        status="ACTIVE",
        priority="HIGH",
        weekId=week_id,
        targetDate=parse_date_key(week_days[6]),
        color="#f0c56b",
    )
    db.add(week_objective)
    db.flush()

    project = Objective(
        userId=user_id,
        parentId=week_objective.id,
        title="Primary project",
        summary="A sample project linked to weekly blocks.",
        nextAction="Ship one visible step this week.",
        kind="PROJECT",
        horizon="WEEK",
        status="ACTIVE",
        priority="HIGH",
        weekId=week_id,
        color="#f08b8f",
    )
    db.add(project)
    db.flush()

    db.add_all(
        [
            Objective(
                userId=user_id,
                parentId=project.id,
                title="Define milestone",
                summary="Write the exact outcome you want by Friday.",
                kind="MILESTONE",
                horizon="WEEK",
                status="PLANNED",
                priority="MEDIUM",
                weekId=week_id,
                color="#b78cff",
            ),
            Objective(
                userId=user_id,
                parentId=project.id,
                title="Review and adjust",
                summary="Use Sunday to adjust the plan instead of forcing more output.",
                kind="MILESTONE",
                horizon="WEEK",
                status="PLANNED",
                priority="LOW",
                weekId=week_id,
                color="#7dd3fc",
            ),
            WeeklyPlanBlock(
                userId=user_id,
                objectiveId=project.id,
                title="Deep work block",
                category="WORK",
                date=parse_date_key(week_days[0]),
                startTime="09:00",
                endTime="11:00",
                durationMinutes=120,
            ),
            WeeklyPlanBlock(
                userId=user_id,
                objectiveId=project.id,
                title="Admin and planning",
                category="ADMIN",
                date=parse_date_key(week_days[2]),
                startTime="17:00",
                endTime="18:00",
                durationMinutes=60,
            ),
            WeeklyPlanBlock(
                userId=user_id,
                objectiveId=week_objective.id,
                title="Weekly review",
                category="REST",
                date=parse_date_key(week_days[6]),
                startTime="18:00",
                endTime="19:00",
                durationMinutes=60,
                flexible=True,
            ),
        ]
    )
    db.flush()

    return get_objectives_data(db, user_id, week_id)
