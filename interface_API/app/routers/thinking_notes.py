from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..contracts.thinking_notes import ThinkingNoteCreateRequest, ThinkingNoteUpdateRequest
from ..core.dates import iso_datetime
from ..core.tags_companies import resolve_tag_ids, set_note_tags
from ..database import get_db
from ..models import Tag, Task, ThinkingNote, ThinkingNoteTag, ThinkingNoteTask, User
from ..security import get_current_user

router = APIRouter(prefix="/api/thinking-notes", tags=["thinking-notes"])


def _tags_by_note_id(db: Session, note_ids: list[str]) -> dict[str, list[dict]]:
    if not note_ids:
        return {}
    rows = db.execute(
        select(ThinkingNoteTag.noteId, Tag)
        .join(Tag, Tag.id == ThinkingNoteTag.tagId)
        .where(ThinkingNoteTag.noteId.in_(note_ids))
    ).all()
    grouped: dict[str, list[dict]] = {}
    for note_id, tag in rows:
        grouped.setdefault(note_id, []).append({"id": tag.id, "name": tag.name, "color": tag.color})
    return grouped


def _tasks_by_note_id(db: Session, note_ids: list[str]) -> dict[str, list[dict]]:
    if not note_ids:
        return {}
    rows = db.execute(
        select(ThinkingNoteTask.noteId, Task)
        .join(Task, Task.id == ThinkingNoteTask.taskId)
        .where(ThinkingNoteTask.noteId.in_(note_ids))
    ).all()
    grouped: dict[str, list[dict]] = {}
    for note_id, task in rows:
        grouped.setdefault(note_id, []).append({"id": task.id, "title": task.title})
    return grouped


def serialize_note(
    note: ThinkingNote,
    tags: list[dict] | None = None,
    tasks: list[dict] | None = None,
) -> dict:
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "reminderAt": iso_datetime(note.reminderAt),
        "tags": tags or [],
        "tasks": tasks or [],
        "createdAt": iso_datetime(note.createdAt),
        "updatedAt": iso_datetime(note.updatedAt),
    }


def _set_note_tasks(db: Session, note_id: str, user_id: str, task_ids: list[str]) -> None:
    db.execute(delete(ThinkingNoteTask).where(ThinkingNoteTask.noteId == note_id))
    owned_ids = set(
        db.execute(select(Task.id).where(Task.userId == user_id, Task.id.in_(task_ids))).scalars()
    )
    for task_id in task_ids:
        if task_id in owned_ids:
            db.add(ThinkingNoteTask(noteId=note_id, taskId=task_id))
    db.flush()


@router.get("")
def list_notes(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notes = list(
        db.execute(
            select(ThinkingNote)
            .where(ThinkingNote.userId == user.id)
            .order_by(ThinkingNote.reminderAt.asc().nulls_last(), ThinkingNote.createdAt.desc())
        ).scalars()
    )
    note_ids = [note.id for note in notes]
    tags_by_note = _tags_by_note_id(db, note_ids)
    tasks_by_note = _tasks_by_note_id(db, note_ids)
    return {
        "notes": [
            serialize_note(note, tags_by_note.get(note.id, []), tasks_by_note.get(note.id, []))
            for note in notes
        ]
    }


@router.post("")
def create_note(
    body: ThinkingNoteCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = ThinkingNote(
        userId=user.id,
        title=body.title,
        content=body.content,
        reminderAt=body.reminder_at,
    )
    db.add(note)
    db.flush()
    tag_ids = resolve_tag_ids(db, user.id, body.tag_ids, body.tag_names)
    if tag_ids:
        set_note_tags(db, note.id, tag_ids)
    if body.task_ids:
        _set_note_tasks(db, note.id, user.id, body.task_ids)
    db.flush()
    return {
        "note": serialize_note(
            note,
            _tags_by_note_id(db, [note.id]).get(note.id, []),
            _tasks_by_note_id(db, [note.id]).get(note.id, []),
        )
    }


@router.patch("")
def update_note(
    body: ThinkingNoteUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(ThinkingNote).where(ThinkingNote.id == body.id, ThinkingNote.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Thinking note not found")

    provided_fields = body.model_fields_set
    if "title" in provided_fields:
        existing.title = body.title
    if body.content is not None:
        existing.content = body.content
    if "reminder_at" in provided_fields:
        existing.reminderAt = body.reminder_at
    if body.tag_ids is not None or body.tag_names is not None:
        tag_ids = resolve_tag_ids(db, user.id, body.tag_ids, body.tag_names)
        set_note_tags(db, existing.id, tag_ids)
    if body.task_ids is not None:
        _set_note_tasks(db, existing.id, user.id, body.task_ids)
    db.flush()
    return {
        "note": serialize_note(
            existing,
            _tags_by_note_id(db, [existing.id]).get(existing.id, []),
            _tasks_by_note_id(db, [existing.id]).get(existing.id, []),
        )
    }


@router.delete("")
def delete_note(
    id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing note id")
    existing = db.execute(
        select(ThinkingNote).where(ThinkingNote.id == id, ThinkingNote.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Thinking note not found")
    db.delete(existing)
    db.flush()
    return {"ok": True}
