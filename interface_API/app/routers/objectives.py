from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

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


def _as_enum(value, fallback: str) -> str:
    return str(value or fallback).upper()


def _normalize_week_id(body: dict) -> str | None:
    if body.get("weekId"):
        return body["weekId"]
    if (body.get("horizon") or "").lower() == "week" and body.get("targetDate"):
        return get_iso_week_id(body["targetDate"])
    if (body.get("horizon") or "").lower() == "week":
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
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.get("kind") == "bootstrap_demo":
        return bootstrap_objectives_demo(db, user.id, body.get("weekId") or get_iso_week_id())

    if body.get("kind") == "weekly_block":
        block = WeeklyPlanBlock(
            userId=user.id,
            objectiveId=body.get("objectiveId") or None,
            title=body.get("title") or "Planned block",
            category=_as_enum(body.get("category"), "WORK"),
            date=parse_date_key(body.get("date") or to_date_key()),
            startTime=body.get("startTime") or None,
            endTime=body.get("endTime") or None,
            durationMinutes=body.get("durationMinutes") if body.get("durationMinutes") is not None else 60,
            flexible=body.get("flexible") or False,
            note=body.get("note") or None,
        )
        db.add(block)
        db.flush()
        return {
            "block": {"id": block.id},
            "data": get_objectives_data(
                db, user.id, body.get("weekId") or get_iso_week_id(block.date.isoformat())
            ),
        }

    objective = Objective(
        userId=user.id,
        parentId=body.get("parentId") or None,
        title=(body.get("title") or "").strip() or default_objective_title(body.get("kind")),
        summary=body.get("summary") or None,
        nextAction=body.get("nextAction") or None,
        kind=_as_enum(body.get("kind"), "OBJECTIVE"),
        horizon=_as_enum(body.get("horizon"), "WEEK"),
        status=_as_enum(body.get("status"), "PLANNED"),
        priority=_as_enum(body.get("priority"), "MEDIUM"),
        targetDate=parse_date_key(body["targetDate"]) if body.get("targetDate") else None,
        weekId=_normalize_week_id(body),
        color=body.get("color") or "#8da2fb",
        sortOrder=body.get("sortOrder") if body.get("sortOrder") is not None else 0,
    )
    db.add(objective)
    db.flush()
    linked = body.get("linkedTaskIds")
    sync_objective_tasks(db, user.id, objective.id, linked if isinstance(linked, list) else [])
    return {
        "objective": {"id": objective.id},
        "data": get_objectives_data(db, user.id, body.get("weekId") or _normalize_week_id(body)),
    }


@router.patch("")
def update_objective(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.get("kind") == "weekly_block":
        existing = db.execute(
            select(WeeklyPlanBlock).where(
                WeeklyPlanBlock.id == body.get("id"), WeeklyPlanBlock.userId == user.id
            )
        ).scalar_one_or_none()
        if existing is None:
            return JSONResponse({"error": "Weekly block not found"}, status_code=404)
        if "objectiveId" in body:
            existing.objectiveId = body["objectiveId"] or None
        if body.get("title") is not None:
            existing.title = body["title"]
        if body.get("category"):
            existing.category = _as_enum(body["category"], "WORK")
        if body.get("date"):
            existing.date = parse_date_key(body["date"])
        if "startTime" in body:
            existing.startTime = body["startTime"] or None
        if "endTime" in body:
            existing.endTime = body["endTime"] or None
        if body.get("durationMinutes") is not None:
            existing.durationMinutes = body["durationMinutes"]
        if body.get("flexible") is not None:
            existing.flexible = body["flexible"]
        if "note" in body:
            existing.note = body["note"] or None
        db.flush()
        return {
            "block": {"id": existing.id},
            "data": get_objectives_data(
                db, user.id, body.get("weekId") or get_iso_week_id(existing.date.isoformat())
            ),
        }

    existing = db.execute(
        select(Objective).where(Objective.id == body.get("id"), Objective.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Objective not found"}, status_code=404)
    if body.get("parentId") and body["parentId"] == existing.id:
        return JSONResponse({"error": "An objective cannot be its own parent."}, status_code=400)

    if "parentId" in body:
        existing.parentId = body["parentId"] or None
    if body.get("title") is not None:
        existing.title = body["title"]
    if "summary" in body:
        existing.summary = body["summary"] or None
    if "nextAction" in body:
        existing.nextAction = body["nextAction"] or None
    if body.get("kind"):
        existing.kind = _as_enum(body["kind"], existing.kind)
    if body.get("horizon"):
        existing.horizon = _as_enum(body["horizon"], existing.horizon)
    if body.get("status"):
        existing.status = _as_enum(body["status"], existing.status)
    if body.get("priority"):
        existing.priority = _as_enum(body["priority"], existing.priority)
    if "targetDate" in body:
        existing.targetDate = parse_date_key(body["targetDate"]) if body["targetDate"] else None
    if "weekId" in body:
        existing.weekId = body["weekId"] or None
    if body.get("color") is not None:
        existing.color = body["color"]
    if body.get("sortOrder") is not None:
        existing.sortOrder = body["sortOrder"]
    if body.get("archived") is not None:
        existing.archived = body["archived"]
    db.flush()
    if isinstance(body.get("linkedTaskIds"), list):
        sync_objective_tasks(db, user.id, existing.id, body["linkedTaskIds"])
    return {
        "objective": {"id": existing.id},
        "data": get_objectives_data(
            db, user.id, body.get("weekId") or existing.weekId or get_iso_week_id()
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
        return JSONResponse({"error": "Missing id"}, status_code=400)

    if kind == "weekly_block":
        existing = db.execute(
            select(WeeklyPlanBlock).where(WeeklyPlanBlock.id == id, WeeklyPlanBlock.userId == user.id)
        ).scalar_one_or_none()
        if existing is None:
            return JSONResponse({"error": "Weekly block not found"}, status_code=404)
        db.delete(existing)
        db.flush()
        return get_objectives_data(db, user.id, week_id)

    existing = db.execute(
        select(Objective).where(Objective.id == id, Objective.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Objective not found"}, status_code=404)

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
