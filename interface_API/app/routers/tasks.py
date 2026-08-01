from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..contracts.tasks import TaskCreateRequest, TaskUpdateRequest
from ..database import get_db
from ..models import Objective, Task, User
from ..security import get_current_user
from ..core.dates import add_days, iso_datetime, parse_date_key, to_date_key
from ..core.scoring import recompute_around_date

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _validate_objective_access(db: Session, user_id: str, objective_id: str | None) -> None:
    if not objective_id:
        return
    objective = db.execute(
        select(Objective).where(Objective.id == objective_id, Objective.userId == user_id)
    ).scalar_one_or_none()
    if objective is None:
        raise HTTPException(status_code=400, detail="Invalid objectiveId")


def _objective_title(db: Session, objective_id: str | None) -> str | None:
    if not objective_id:
        return None
    objective = db.get(Objective, objective_id)
    return objective.title if objective else None


def serialize_task(
    db: Session,
    task: Task | None,
    objective_title: str | None = None,
) -> dict | None:
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
        "objectiveTitle": objective_title if objective_title is not None else _objective_title(db, task.objectiveId),
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
    query = (
        select(Task, Objective.title)
        .outerjoin(
            Objective,
            and_(Objective.id == Task.objectiveId, Objective.userId == user.id),
        )
        .where(Task.userId == user.id)
    )
    if scope != "all":
        query = query.where(Task.date == parse_date_key(date_key))
    task_rows = list(
        db.execute(
            query.order_by(Task.date.asc(), Task.status.asc(), Task.importance.desc(), Task.createdAt.asc())
        ).all()
    )
    return {
        "tasks": [
            serialize_task(db, task, objective_title)
            for task, objective_title in task_rows
        ]
    }


@router.post("")
def create_tasks(
    body: TaskCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    date_key = body.date.isoformat() if body.date else to_date_key()
    if body.titles:
        titles = [title.strip() for title in body.titles]
    else:
        titles = [(body.title or "Untitled task").strip()]
    titles = [title for title in titles if title]
    _validate_objective_access(db, user.id, body.objective_id)

    tasks = []
    for title in titles:
        task = Task(
            userId=user.id,
            title=title,
            date=parse_date_key(date_key),
            objectiveId=body.objective_id or None,
            importance=body.importance.value,
            productive=body.productive,
            estimatedMinutes=body.estimated_minutes,
            completionPercent=body.completion_percent,
            status=body.status.value,
        )
        db.add(task)
        tasks.append(task)
    db.flush()
    recompute_around_date(db, user.id, date_key)
    serialized = [serialize_task(db, task) for task in tasks]
    return {"task": serialized[0] if serialized else None, "tasks": serialized}


@router.patch("")
def update_task(
    body: TaskUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(Task).where(Task.id == body.id, Task.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Task not found")

    provided_fields = body.model_fields_set
    if body.title is not None:
        existing.title = body.title
    if body.date is not None:
        existing.date = body.date
    if "objective_id" in provided_fields:
        _validate_objective_access(db, user.id, body.objective_id)
        existing.objectiveId = body.objective_id or None
    if body.importance is not None:
        existing.importance = body.importance.value
    if body.productive is not None:
        existing.productive = body.productive
    if body.estimated_minutes is not None:
        existing.estimatedMinutes = body.estimated_minutes
    if body.completion_percent is not None:
        existing.completionPercent = body.completion_percent
    if body.status is not None:
        existing.status = body.status.value
    db.flush()
    recompute_around_date(db, user.id, existing.date.isoformat())
    return {"task": serialize_task(db, existing)}
