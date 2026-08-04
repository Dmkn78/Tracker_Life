from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..contracts.tags import TagCreateRequest, TagUpdateRequest
from ..database import get_db
from ..models import Tag, User
from ..security import get_current_user

router = APIRouter(prefix="/api/tags", tags=["tags"])


def serialize_tag(tag: Tag) -> dict:
    return {"id": tag.id, "name": tag.name, "color": tag.color}


@router.get("")
def list_tags(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tags = db.execute(
        select(Tag).where(Tag.userId == user.id).order_by(Tag.name.asc())
    ).scalars()
    return {"tags": [serialize_tag(tag) for tag in tags]}


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
        select(Tag).where(Tag.id == id, Tag.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(existing)
    db.flush()
    return {"ok": True}
