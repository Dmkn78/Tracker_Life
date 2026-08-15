from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..contracts.tags import TagCreateRequest, TagUpdateRequest
from ..database import get_db
from ..models import Tag, TaskTag, ThinkingNoteTag, User
from ..security import get_current_user

router = APIRouter(prefix="/api/tags", tags=["tags"])


def serialize_tag(tag: Tag, usage_count: int = 0) -> dict:
    return {"id": tag.id, "name": tag.name, "color": tag.color, "usageCount": usage_count}


@router.get("")
def list_tags(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task_usage = (
        select(TaskTag.tagId.label("tag_id"), func.count().label("usage_count"))
        .group_by(TaskTag.tagId)
        .subquery()
    )
    note_usage = (
        select(ThinkingNoteTag.tagId.label("tag_id"), func.count().label("usage_count"))
        .group_by(ThinkingNoteTag.tagId)
        .subquery()
    )
    rows = db.execute(
        select(
            Tag,
            (func.coalesce(task_usage.c.usage_count, 0) + func.coalesce(note_usage.c.usage_count, 0)).label("usage_count"),
        )
        .outerjoin(task_usage, task_usage.c.tag_id == Tag.id)
        .outerjoin(note_usage, note_usage.c.tag_id == Tag.id)
        .where(Tag.userId == user.id)
        .order_by(Tag.name.asc())
    ).all()
    return {"tags": [serialize_tag(tag, usage_count) for tag, usage_count in rows]}


@router.post("")
def create_tag(
    body: TagCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    existing = db.execute(
        select(Tag).where(Tag.userId == user.id, Tag.name == name)
    ).scalar_one_or_none()
    if existing:
        return {"tag": serialize_tag(existing)}
    tag = Tag(userId=user.id, name=name, color=body.color or "#57c59a")
    db.add(tag)
    db.flush()
    return {"tag": serialize_tag(tag)}


@router.patch("")
def update_tag(
    body: TagUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(Tag).where(Tag.id == body.id, Tag.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    if body.name is not None:
        existing.name = body.name.strip()
    if body.color is not None:
        existing.color = body.color
    db.flush()
    return {"tag": serialize_tag(existing)}


@router.delete("")
def delete_tag(
    id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing tag id")
    existing = db.execute(
        select(Tag).where(Tag.id == id, Tag.userId == user.id).with_for_update()
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    task_usage_count = db.execute(
        select(func.count()).select_from(TaskTag).where(TaskTag.tagId == id)
    ).scalar_one()
    note_usage_count = db.execute(
        select(func.count()).select_from(ThinkingNoteTag).where(ThinkingNoteTag.tagId == id)
    ).scalar_one()
    usage_count = task_usage_count + note_usage_count
    if usage_count > 0:
        raise HTTPException(status_code=409, detail="Detach this tag from every task and note before deleting it")
    db.delete(existing)
    db.flush()
    return {"ok": True}
