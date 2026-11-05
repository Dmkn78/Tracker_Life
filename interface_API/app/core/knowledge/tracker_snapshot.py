"""Database boundary: read everything the vault projection needs in a few grouped queries."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...models import DailyLog, Objective, Tag, Task, ThinkingNote, ThinkingNoteTag, WeeklyRecap
from ..dates import get_iso_week_id
from .projected_notes import DaySnapshot, IdeaSnapshot, ObjectiveSnapshot, TaskSnapshot

IDEA_TITLE_LENGTH = 60


@dataclass(frozen=True)
class TrackerSnapshot:
    days: list[DaySnapshot]
    week_recaps: dict[str, str]
    objectives: list[ObjectiveSnapshot]
    ideas: list[IdeaSnapshot]

    def days_by_week(self) -> dict[str, list[DaySnapshot]]:
        grouped_days: dict[str, list[DaySnapshot]] = defaultdict(list)
        for day in self.days:
            grouped_days[get_iso_week_id(day.day.isoformat())].append(day)
        for week_id in self.week_recaps:
            grouped_days.setdefault(week_id, [])
        return dict(grouped_days)


def load_tracker_snapshot(db: Session, user_id: str) -> TrackerSnapshot:
    objectives = list(db.scalars(select(Objective).where(Objective.userId == user_id, Objective.archived.is_(False))))
    objective_titles = {objective.id: objective.title for objective in objectives}
    tasks = [_snapshot_task(task, objective_titles) for task in db.scalars(
        select(Task).where(Task.userId == user_id).order_by(Task.date.asc(), Task.sortOrder.asc(), Task.createdAt.asc())
    )]
    logs = {log.date: log for log in db.scalars(select(DailyLog).where(DailyLog.userId == user_id))}
    snapshot = TrackerSnapshot(
        days=_build_day_snapshots(tasks, logs),
        week_recaps={recap.weekId: recap.text for recap in db.scalars(select(WeeklyRecap).where(WeeklyRecap.userId == user_id))},
        objectives=[_snapshot_objective(objective, tasks) for objective in objectives],
        ideas=_load_ideas(db, user_id),
    )
    return snapshot


def _snapshot_task(task: Task, objective_titles: dict[str, str]) -> TaskSnapshot:
    task_snapshot = TaskSnapshot(
        title=task.title, status=task.status, day=task.date, objective_id=task.objectiveId,
        objective_title=objective_titles.get(task.objectiveId or ""), not_done_reason=task.notDoneReason,
    )
    return task_snapshot


def _build_day_snapshots(tasks: list[TaskSnapshot], logs: dict[date, DailyLog]) -> list[DaySnapshot]:
    tasks_by_day: dict[date, list[TaskSnapshot]] = defaultdict(list)
    for task in tasks:
        if task.day is not None:
            tasks_by_day[task.day].append(task)
    day_snapshots: list[DaySnapshot] = []
    for day in sorted(set(tasks_by_day) | set(logs)):
        log = logs.get(day)
        day_snapshots.append(DaySnapshot(
            day=day,
            recap=log.textSummary if log else None,
            tasks=tasks_by_day.get(day, []),
            blockers=[*(log.blockers or []), *([log.mainBlocker] if log.mainBlocker else [])] if log else [],
            wins=list(log.wins or []) if log else [],
            improvements=list(log.topImprovements or []) if log else [],
            tomorrow_priorities=list(log.tomorrowPriorities or []) if log else [],
        ))
    return day_snapshots


def _snapshot_objective(objective: Objective, tasks: list[TaskSnapshot]) -> ObjectiveSnapshot:
    objective_snapshot = ObjectiveSnapshot(
        objective_id=objective.id, title=objective.title, summary=objective.summary, next_action=objective.nextAction,
        status=objective.status, horizon=objective.horizon,
        tasks=[task for task in tasks if task.objective_id == objective.id],
    )
    return objective_snapshot


def _load_ideas(db: Session, user_id: str) -> list[IdeaSnapshot]:
    notes = list(db.scalars(select(ThinkingNote).where(ThinkingNote.userId == user_id).order_by(ThinkingNote.createdAt.asc())))
    tag_rows = db.execute(
        select(ThinkingNoteTag.noteId, Tag.name).join(Tag, Tag.id == ThinkingNoteTag.tagId).where(Tag.userId == user_id)
    ).all()
    tags_by_note: dict[str, list[str]] = defaultdict(list)
    for note_id, tag_name in tag_rows:
        tags_by_note[note_id].append(tag_name.replace(" ", "-"))
    ideas = [
        IdeaSnapshot(
            note_id=note.id,
            title=(note.title or note.content.split("\n", 1)[0])[:IDEA_TITLE_LENGTH].strip() or "Idée",
            content=note.content,
            created_on=note.createdAt.date(),
            tags=tags_by_note.get(note.id, []),
        )
        for note in notes
    ]
    return ideas
