from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Objective, Task, User
from ..security import get_current_user
from ..core.dates import add_days, iso_datetime, parse_date_key, to_date_key
from ..core.scoring import recompute_around_date

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _objective_title(db: Session, objective_id: str | None) -> str | None:
    if not objective_id:
        return None
    objective = db.get(Objective, objective_id)
    return objective.title if objective else None


def serialize_task(db: Session, task: Task | None) -> dict | None:
    if task is None:
        return None
    return {
        "id": task.id,
        "userId": task.userId,
        "title": task.title,
        "date": task.date.isoformat(),
        "importance": task.importance.lower(),
        "productive": task.productive,
        "estimatedMinutes": task.estimatedMinutes,
        "completionPercent": task.completionPercent,
        "status": task.status.lower(),
        "objectiveId": task.objectiveId,
        "objectiveTitle": _objective_title(db, task.objectiveId),
        "createdAt": iso_datetime(task.createdAt),
        "updatedAt": iso_datetime(task.updatedAt),
    }


@router.get("")
def list_tasks(
    scope: str = Query(default="today"),
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    date_key = add_days(to_date_key(), 1) if scope == "tomorrow" else (date or to_date_key())
    query = select(Task).where(Task.userId == user.id)
    if scope != "all":
        query = query.where(Task.date == parse_date_key(date_key))
    tasks = list(
        db.execute(
            query.order_by(Task.date.asc(), Task.status.asc(), Task.importance.desc(), Task.createdAt.asc())
        ).scalars()
    )
    return {"tasks": [serialize_task(db, task) for task in tasks]}


@router.post("")
def create_tasks(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    date_key = body.get("date") or to_date_key()
    raw_titles = body.get("titles")
    if isinstance(raw_titles, list) and raw_titles:
        titles = [str(title or "").strip() for title in raw_titles]
    else:
        titles = [str(body.get("title") or "Untitled task").strip()]
    titles = [title for title in titles if title]

    tasks = []
    for title in titles:
        task = Task(
            userId=user.id,
            title=title,
            date=parse_date_key(date_key),
            objectiveId=body.get("objectiveId") or None,
            importance=str(body.get("importance") or "MEDIUM").upper(),
            productive=body.get("productive") if body.get("productive") is not None else True,
            estimatedMinutes=body.get("estimatedMinutes") or 0,
            completionPercent=body.get("completionPercent") or 0,
            status=str(body.get("status") or "PLANNED").upper(),
        )
        db.add(task)
        tasks.append(task)
    db.flush()
    recompute_around_date(db, user.id, date_key)
    serialized = [serialize_task(db, task) for task in tasks]
    return {"task": serialized[0] if serialized else None, "tasks": serialized}


@router.patch("")
def update_task(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(Task).where(Task.id == body.get("id"), Task.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Task not found"}, status_code=404)

    if body.get("title") is not None:
        existing.title = body["title"]
    if body.get("date"):
        existing.date = parse_date_key(body["date"])
    if "objectiveId" in body:
        existing.objectiveId = body["objectiveId"] or None
    if body.get("importance"):
        existing.importance = str(body["importance"]).upper()
    if body.get("productive") is not None:
        existing.productive = body["productive"]
    if body.get("estimatedMinutes") is not None:
        existing.estimatedMinutes = body["estimatedMinutes"]
    if body.get("completionPercent") is not None:
        existing.completionPercent = body["completionPercent"]
    if body.get("status"):
        existing.status = str(body["status"]).upper()
    db.flush()
    recompute_around_date(db, user.id, existing.date.isoformat())
    return {"task": serialize_task(db, existing)}
