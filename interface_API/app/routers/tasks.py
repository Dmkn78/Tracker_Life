from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session

from ..contracts.tasks import TaskCreateRequest, TaskReorderRequest, TaskUpdateRequest
from ..core.tags_companies import resolve_company_id, resolve_tag_ids, set_task_tags
from ..database import get_db
from ..models import Company, Objective, Tag, Task, TaskTag, ThinkingNoteTask, User
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


def _tags_by_task_id(db: Session, task_ids: list[str]) -> dict[str, list[dict]]:
    if not task_ids:
        return {}
    rows = db.execute(
        select(TaskTag.taskId, Tag).join(Tag, Tag.id == TaskTag.tagId).where(TaskTag.taskId.in_(task_ids))
    ).all()
    grouped: dict[str, list[dict]] = {}
    for task_id, tag in rows:
        grouped.setdefault(task_id, []).append({"id": tag.id, "name": tag.name, "color": tag.color})
    return grouped


def serialize_task(
    db: Session,
    task: Task | None,
    objective_title: str | None = None,
    tags: list[dict] | None = None,
    company: Company | None = None,
) -> dict | None:
    if task is None:
        return None
    resolved_company = company
    if resolved_company is None and task.companyId:
        resolved_company = db.get(Company, task.companyId)
    return {
        "id": task.id,
        "userId": task.userId,
        "title": task.title,
        "description": task.description,
        "date": task.date.isoformat() if task.date else None,
        "startTime": task.startTime,
        "endTime": task.endTime,
        "importance": task.importance.lower(),
        "productive": task.productive,
        "estimatedMinutes": task.estimatedMinutes,
        "completionPercent": task.completionPercent,
        "status": task.status.lower(),
        "notDoneReason": task.notDoneReason,
        "sortOrder": task.sortOrder,
        "objectiveId": task.objectiveId,
        "objectiveTitle": objective_title if objective_title is not None else _objective_title(db, task.objectiveId),
        "companyId": task.companyId,
        "companyName": resolved_company.name if resolved_company else None,
        "companyColor": resolved_company.color if resolved_company else None,
        "tags": tags if tags is not None else _tags_by_task_id(db, [task.id]).get(task.id, []),
        "createdAt": iso_datetime(task.createdAt),
        "updatedAt": iso_datetime(task.updatedAt),
    }


@router.get("")
def list_tasks(
    scope: str = Query(default="today"),
    date: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        select(Task, Objective.title)
        .outerjoin(
            Objective,
            and_(Objective.id == Task.objectiveId, Objective.userId == user.id),
        )
        .where(Task.userId == user.id)
    )
    if from_ or to:
        range_start = parse_date_key(from_) if from_ else None
        range_end = parse_date_key(to) if to else None
        if range_start and range_end and range_start > range_end:
            raise HTTPException(status_code=400, detail="Invalid task date range")
        if from_:
            query = query.where(Task.date >= range_start)
        if to:
            query = query.where(Task.date <= range_end)
    elif scope != "all":
        date_key = add_days(to_date_key(), 1) if scope == "tomorrow" else (date or to_date_key())
        query = query.where(Task.date == parse_date_key(date_key))

    task_rows = list(
        db.execute(
            query.order_by(Task.sortOrder.asc(), Task.status.asc(), Task.importance.desc(), Task.createdAt.asc())
        ).all()
    )
    task_ids = [task.id for task, _ in task_rows]
    tags_by_task = _tags_by_task_id(db, task_ids)
    company_ids = {task.companyId for task, _ in task_rows if task.companyId}
    companies_by_id = {
        company.id: company
        for company in db.execute(select(Company).where(Company.id.in_(company_ids))).scalars()
    } if company_ids else {}
    return {
        "tasks": [
            serialize_task(
                db,
                task,
                objective_title,
                tags_by_task.get(task.id, []),
                companies_by_id.get(task.companyId) if task.companyId else None,
            )
            for task, objective_title in task_rows
        ]
    }


def _create_one_task(db: Session, user: User, item) -> Task:
    _validate_objective_access(db, user.id, item.objective_id)
    company_id = resolve_company_id(db, user.id, item.company_id, item.company_name)
    tag_ids = resolve_tag_ids(db, user.id, item.tag_ids, item.tag_names)
    task = Task(
        userId=user.id,
        title=item.title.strip() or "Untitled task",
        description=item.description,
        date=item.date,
        startTime=item.start_time,
        endTime=item.end_time,
        objectiveId=item.objective_id or None,
        companyId=company_id,
        importance=item.importance.value,
        productive=item.productive,
        estimatedMinutes=item.estimated_minutes,
        completionPercent=item.completion_percent,
        status=item.status.value,
        notDoneReason=item.not_done_reason if item.status.value == "NOT_DONE" else None,
    )
    db.add(task)
    db.flush()
    if tag_ids:
        set_task_tags(db, task.id, tag_ids)
    return task


@router.post("")
def create_tasks(
    body: TaskCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = [item for item in body.resolve_items() if item.title.strip()]
    tasks = [_create_one_task(db, user, item) for item in items]
    db.flush()
    for date_key in {task.date.isoformat() for task in tasks if task.date}:
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
    if "description" in provided_fields:
        existing.description = body.description
    if "date" in provided_fields:
        existing.date = body.date
    if "start_time" in provided_fields:
        existing.startTime = body.start_time
    if "end_time" in provided_fields:
        existing.endTime = body.end_time
    if "objective_id" in provided_fields:
        _validate_objective_access(db, user.id, body.objective_id)
        existing.objectiveId = body.objective_id or None
    if "company_id" in provided_fields or "company_name" in provided_fields:
        existing.companyId = resolve_company_id(db, user.id, body.company_id, body.company_name)
    if body.tag_ids is not None or body.tag_names is not None:
        tag_ids = resolve_tag_ids(db, user.id, body.tag_ids, body.tag_names)
        set_task_tags(db, existing.id, tag_ids)
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
    next_status = body.status.value if body.status is not None else existing.status
    if next_status == "NOT_DONE":
        if "not_done_reason" in provided_fields:
            existing.notDoneReason = body.not_done_reason
    else:
        existing.notDoneReason = None
    if body.sort_order is not None:
        existing.sortOrder = body.sort_order
    db.flush()
    if existing.date:
        recompute_around_date(db, user.id, existing.date.isoformat())
    return {"task": serialize_task(db, existing)}


@router.patch("/reorder")
def reorder_tasks(
    body: TaskReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_ids = set(
        db.execute(
            select(Task.id).where(Task.userId == user.id, Task.id.in_(body.ids))
        ).scalars()
    )
    for index, task_id in enumerate(body.ids):
        if task_id not in owned_ids:
            continue
        db.execute(
            Task.__table__.update().where(Task.id == task_id).values(sortOrder=(index + 1) * 10)
        )
    db.flush()
    return {"ok": True}


@router.delete("")
def delete_task(
    id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing task id")
    existing = db.execute(
        select(Task).where(Task.id == id, Task.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Task not found")
    db.execute(delete(TaskTag).where(TaskTag.taskId == existing.id))
    db.execute(delete(ThinkingNoteTask).where(ThinkingNoteTask.taskId == existing.id))
    db.delete(existing)
    db.flush()
    return {"ok": True}
