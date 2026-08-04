"""Shared helpers to resolve/upsert Company and Tag references by id or free-text name.

Used by any router that lets a user pick an existing company/tag or type a new
one inline (Task, CalendarEvent, ThinkingNote) so there is a single place that
owns "select-or-create" semantics and keeps Company/Tag as the single source
of truth (no free-text duplicates of the same company/tag per user).
"""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import Company, Tag


def resolve_company_id(
    db: Session,
    user_id: str,
    company_id: str | None,
    company_name: str | None,
) -> str | None:
    if company_id:
        company = db.execute(
            select(Company).where(Company.id == company_id, Company.userId == user_id)
        ).scalar_one_or_none()
        if company is None:
            return None
        return company.id
    name = (company_name or "").strip()
    if not name:
        return None
    existing = db.execute(
        select(Company).where(Company.userId == user_id, Company.name == name)
    ).scalar_one_or_none()
    if existing:
        return existing.id
    company = Company(userId=user_id, name=name)
    db.add(company)
    db.flush()
    return company.id


def resolve_tag_ids(
    db: Session,
    user_id: str,
    tag_ids: list[str] | None,
    tag_names: list[str] | None,
) -> list[str]:
    resolved: list[str] = []
    for tag_id in tag_ids or []:
        tag = db.execute(
            select(Tag).where(Tag.id == tag_id, Tag.userId == user_id)
        ).scalar_one_or_none()
        if tag:
            resolved.append(tag.id)
    for raw_name in tag_names or []:
        name = raw_name.strip()
        if not name:
            continue
        existing = db.execute(
            select(Tag).where(Tag.userId == user_id, Tag.name == name)
        ).scalar_one_or_none()
        if existing:
            resolved.append(existing.id)
            continue
        tag = Tag(userId=user_id, name=name)
        db.add(tag)
        db.flush()
        resolved.append(tag.id)
    seen: set[str] = set()
    unique: list[str] = []
    for tag_id in resolved:
        if tag_id not in seen:
            seen.add(tag_id)
            unique.append(tag_id)
    return unique


def set_task_tags(db: Session, task_id: str, tag_ids: list[str]) -> None:
    from ..models import TaskTag

    db.execute(delete(TaskTag).where(TaskTag.taskId == task_id))
    for tag_id in tag_ids:
        db.add(TaskTag(taskId=task_id, tagId=tag_id))
    db.flush()


def set_note_tags(db: Session, note_id: str, tag_ids: list[str]) -> None:
    from ..models import ThinkingNoteTag

    db.execute(delete(ThinkingNoteTag).where(ThinkingNoteTag.noteId == note_id))
    for tag_id in tag_ids:
        db.add(ThinkingNoteTag(noteId=note_id, tagId=tag_id))
    db.flush()
