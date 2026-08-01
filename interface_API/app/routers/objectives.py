from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..contracts.enums import ObjectiveKind
from ..contracts.objectives import ObjectiveCreateRequest, ObjectiveUpdateRequest
from ..database import get_db
from ..models import Objective, Task, User, WeeklyPlanBlock
from ..security import get_current_user
from ..core.dates import get_iso_week_id, parse_date_key, to_date_key
from ..core.objectives import (
    bootstrap_objectives_demo,
    default_objective_title,
    get_objectives_data,
    sync_objective_tasks,
)

router = APIRouter(prefix="/api/objectives", tags=["objectives"])


def _validate_objective_parent(
    db: Session,
    user_id: str,
    objective_id: str | None,
    parent_id: str | None,
) -> None:
    if not parent_id:
        return

    visited_objective_ids = {objective_id} if objective_id else set()
    current_parent_id: str | None = parent_id
    while current_parent_id:
        if current_parent_id in visited_objective_ids:
            raise HTTPException(status_code=400, detail="Objective hierarchy cannot contain a cycle")
        visited_objective_ids.add(current_parent_id)
        parent = db.execute(
            select(Objective).where(
                Objective.id == current_parent_id,
                Objective.userId == user_id,
                Objective.archived.is_(False),
            )
        ).scalar_one_or_none()
        if parent is None:
            raise HTTPException(status_code=400, detail="Invalid parentId")
        current_parent_id = parent.parentId


def _validate_block_objective(
    db: Session,
    user_id: str,
    objective_id: str | None,
) -> None:
    if not objective_id:
        return
    objective = db.execute(
        select(Objective).where(
            Objective.id == objective_id,
            Objective.userId == user_id,
            Objective.archived.is_(False),
        )
    ).scalar_one_or_none()
    if objective is None:
        raise HTTPException(status_code=400, detail="Invalid objectiveId")


def _normalize_week_id(body: ObjectiveCreateRequest) -> str | None:
    if body.week_id:
        return body.week_id
    if body.horizon.value == "WEEK" and body.target_date:
        return get_iso_week_id(body.target_date.isoformat())
    if body.horizon.value == "WEEK":
        return get_iso_week_id()
    return None


@router.get("")
def get_objectives(
    week_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_objectives_data(db, user.id, week_id or get_iso_week_id())


@router.post("")
def create_objective(
    body: ObjectiveCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.kind == "bootstrap_demo":
        return bootstrap_objectives_demo(db, user.id, body.week_id or get_iso_week_id())

    if body.kind == "weekly_block":
        _validate_block_objective(db, user.id, body.objective_id)
        block_date = body.date or parse_date_key(to_date_key())
        block = WeeklyPlanBlock(
            userId=user.id,
            objectiveId=body.objective_id or None,
            title=body.title or "Planned block",
            category=body.category.value,
            date=block_date,
            startTime=body.start_time or None,
            endTime=body.end_time or None,
            durationMinutes=body.duration_minutes,
            flexible=body.flexible,
            note=body.note or None,
        )
        db.add(block)
        db.flush()
        return {
            "block": {"id": block.id},
            "data": get_objectives_data(
                db, user.id, body.week_id or get_iso_week_id(block.date.isoformat())
            ),
        }

    objective_kind = body.kind if isinstance(body.kind, ObjectiveKind) else ObjectiveKind.OBJECTIVE
    _validate_objective_parent(db, user.id, None, body.parent_id)
    objective = Objective(
        userId=user.id,
        parentId=body.parent_id or None,
        title=(body.title or "").strip() or default_objective_title(objective_kind.value),
        summary=body.summary or None,
        nextAction=body.next_action or None,
        kind=objective_kind.value,
        horizon=body.horizon.value,
        status=body.status.value,
        priority=body.priority.value,
        targetDate=body.target_date,
        weekId=_normalize_week_id(body),
        color=body.color or "#8da2fb",
        sortOrder=body.sort_order,
    )
    db.add(objective)
    db.flush()
    sync_objective_tasks(db, user.id, objective.id, body.linked_task_ids)
    return {
        "objective": {"id": objective.id},
        "data": get_objectives_data(db, user.id, body.week_id or _normalize_week_id(body)),
    }


@router.patch("")
def update_objective(
    body: ObjectiveUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.kind == "weekly_block":
        existing = db.execute(
            select(WeeklyPlanBlock).where(
                WeeklyPlanBlock.id == body.id, WeeklyPlanBlock.userId == user.id
            )
        ).scalar_one_or_none()
        if existing is None:
            raise HTTPException(status_code=404, detail="Weekly block not found")
        provided_fields = body.model_fields_set
        if "objective_id" in provided_fields:
            _validate_block_objective(db, user.id, body.objective_id)
            existing.objectiveId = body.objective_id or None
        if body.title is not None:
            existing.title = body.title
        if body.category is not None:
            existing.category = body.category.value
        if body.date is not None:
            existing.date = body.date
        if "start_time" in provided_fields:
            existing.startTime = body.start_time or None
        if "end_time" in provided_fields:
            existing.endTime = body.end_time or None
        if body.duration_minutes is not None:
            existing.durationMinutes = body.duration_minutes
        if body.flexible is not None:
            existing.flexible = body.flexible
        if "note" in provided_fields:
            existing.note = body.note or None
        db.flush()
        return {
            "block": {"id": existing.id},
            "data": get_objectives_data(
                db, user.id, body.week_id or get_iso_week_id(existing.date.isoformat())
            ),
        }

    existing = db.execute(
        select(Objective).where(Objective.id == body.id, Objective.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Objective not found")
    provided_fields = body.model_fields_set
    if "parent_id" in provided_fields:
        _validate_objective_parent(db, user.id, existing.id, body.parent_id)
        existing.parentId = body.parent_id or None
    if body.title is not None:
        existing.title = body.title
    if "summary" in provided_fields:
        existing.summary = body.summary or None
    if "next_action" in provided_fields:
        existing.nextAction = body.next_action or None
    if isinstance(body.kind, ObjectiveKind):
        existing.kind = body.kind.value
    if body.horizon is not None:
        existing.horizon = body.horizon.value
    if body.status is not None:
        existing.status = body.status.value
    if body.priority is not None:
        existing.priority = body.priority.value
    if "target_date" in provided_fields:
        existing.targetDate = body.target_date
    if "week_id" in provided_fields:
        existing.weekId = body.week_id or None
    if body.color is not None:
        existing.color = body.color
    if body.sort_order is not None:
        existing.sortOrder = body.sort_order
    if body.archived is not None:
        existing.archived = body.archived
    db.flush()
    if body.linked_task_ids is not None:
        sync_objective_tasks(db, user.id, existing.id, body.linked_task_ids)
    return {
        "objective": {"id": existing.id},
        "data": get_objectives_data(
            db, user.id, body.week_id or existing.weekId or get_iso_week_id()
        ),
    }


@router.delete("")
def delete_objective(
    id: str | None = Query(default=None),
    kind: str = Query(default="objective"),
    week_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    week_id = week_id or get_iso_week_id()
    if not id:
        raise HTTPException(status_code=400, detail="Missing id")

    if kind == "weekly_block":
        existing = db.execute(
            select(WeeklyPlanBlock).where(WeeklyPlanBlock.id == id, WeeklyPlanBlock.userId == user.id)
        ).scalar_one_or_none()
        if existing is None:
            raise HTTPException(status_code=404, detail="Weekly block not found")
        db.delete(existing)
        db.flush()
        return get_objectives_data(db, user.id, week_id)

    existing = db.execute(
        select(Objective).where(Objective.id == id, Objective.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Objective not found")

    db.execute(
        update(Task).where(Task.userId == user.id, Task.objectiveId == existing.id).values(objectiveId=None)
    )
    db.execute(
        update(WeeklyPlanBlock)
        .where(WeeklyPlanBlock.userId == user.id, WeeklyPlanBlock.objectiveId == existing.id)
        .values(objectiveId=None)
    )
    existing.archived = True
    db.flush()
    return get_objectives_data(db, user.id, week_id)
