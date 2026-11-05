"""Pure rendering of tracked data (days, weeks, objectives, ideas) into Markdown notes."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from ..dates import get_iso_week_id, get_week_date_keys, parse_date_key
from ..week_board import summarize_task_statuses
from .french_dates import format_long_date, format_short_date
from .note_paths import (
    course_note_path,
    idea_note_path,
    journal_note_path,
    objective_note_path,
    week_note_path,
    wikilink,
)

TRACKER_SOURCE = "tracker"
STATUS_CHECKBOXES = {"DONE": "[x]", "NOT_DONE": "[-]", "CANCELLED": "[-]"}
OPEN_CHECKBOX = "[ ]"
OBJECTIVE_STATUS_LABELS = {
    "PLANNED": "prévu", "ACTIVE": "actif", "ON_TRACK": "en bonne voie",
    "AT_RISK": "à risque", "PAUSED": "en pause", "DONE": "atteint",
}


@dataclass(frozen=True)
class TaskSnapshot:
    title: str
    status: str
    day: date | None
    objective_id: str | None
    objective_title: str | None
    not_done_reason: str | None = None


@dataclass(frozen=True)
class DaySnapshot:
    day: date
    recap: str | None
    tasks: list[TaskSnapshot]
    blockers: list[str] = field(default_factory=list)
    wins: list[str] = field(default_factory=list)
    improvements: list[str] = field(default_factory=list)
    tomorrow_priorities: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ObjectiveSnapshot:
    objective_id: str
    title: str
    summary: str | None
    next_action: str | None
    status: str
    horizon: str
    tasks: list[TaskSnapshot]


@dataclass(frozen=True)
class IdeaSnapshot:
    note_id: str
    title: str
    content: str
    created_on: date
    tags: list[str]


@dataclass(frozen=True)
class DeadlineSnapshot:
    title: str
    kind_label: str
    day: date
    time: str | None
    note: str | None


@dataclass(frozen=True)
class CourseSnapshot:
    course_id: str
    name: str
    deadlines: list[DeadlineSnapshot]


@dataclass(frozen=True)
class ProjectedNote:
    tracker_id: str
    preferred_path: str
    frontmatter: dict
    body: str


def project_day(snapshot: DaySnapshot, objective_paths: dict[str, str]) -> ProjectedNote:
    date_key = snapshot.day.isoformat()
    week_id = get_iso_week_id(date_key)
    summary = summarize_task_statuses([task.status for task in snapshot.tasks])
    lines = [f"# Journal — {format_long_date(snapshot.day)}", "", f"Semaine : {wikilink(week_note_path(week_id), week_id)}", ""]
    lines += ["## Récapitulatif", snapshot.recap.strip() if snapshot.recap else "_Aucun récapitulatif._", ""]
    lines += ["## Tâches", *(_task_line(task, objective_paths) for task in snapshot.tasks)] if snapshot.tasks else ["## Tâches", "_Aucune tâche._"]
    lines += _bullet_section("Bloquants", snapshot.blockers)
    lines += _bullet_section("Réussites", snapshot.wins)
    lines += _bullet_section("À améliorer", snapshot.improvements)
    lines += _bullet_section("Priorités du lendemain", snapshot.tomorrow_priorities)
    frontmatter = {
        "type": "journal", "date": date_key, "week": week_id,
        "tasks_planned": summary.planned, "tasks_done": summary.done,
        "tags": ["tracker/journal"], "source": TRACKER_SOURCE, "tracker_id": f"journal:{date_key}",
    }
    projected_note = ProjectedNote(f"journal:{date_key}", journal_note_path(date_key), frontmatter, "\n".join(lines))
    return projected_note


def project_week(week_id: str, days: list[DaySnapshot], recap: str | None) -> ProjectedNote:
    date_keys = get_week_date_keys(week_id)
    days_by_key = {day.day.isoformat(): day for day in days}
    all_tasks = [task for day in days for task in day.tasks]
    summary = summarize_task_statuses([task.status for task in all_tasks])
    first_day, last_day = parse_date_key(date_keys[0]), parse_date_key(date_keys[-1])
    lines = [f"# Semaine {week_id} — du {format_short_date(first_day)} au {format_short_date(last_day)}", ""]
    lines += ["## Bilan", f"Prévu {summary.planned} · Fait {summary.done} · Abandonné {summary.dropped} · En cours {summary.open}", ""]
    lines += ["## Récapitulatif de la semaine", recap.strip() if recap else "_Aucun récapitulatif._", "", "## Jours"]
    for date_key in date_keys:
        day = days_by_key.get(date_key)
        if day is None:
            continue
        day_summary = summarize_task_statuses([task.status for task in day.tasks])
        label = format_short_date(day.day)
        lines.append(f"- {wikilink(journal_note_path(date_key), label)} — {day_summary.done}/{day_summary.planned} faites")
    frontmatter = {
        "type": "semaine", "week": week_id, "date": date_keys[0],
        "tasks_planned": summary.planned, "tasks_done": summary.done,
        "tags": ["tracker/semaine"], "source": TRACKER_SOURCE, "tracker_id": f"semaine:{week_id}",
    }
    projected_note = ProjectedNote(f"semaine:{week_id}", week_note_path(week_id), frontmatter, "\n".join(lines))
    return projected_note


def project_objective(snapshot: ObjectiveSnapshot) -> ProjectedNote:
    status_label = OBJECTIVE_STATUS_LABELS.get(snapshot.status, snapshot.status.lower())
    lines = [f"# {snapshot.title}", "", f"Statut : {status_label}", ""]
    if snapshot.summary:
        lines += ["## Description", snapshot.summary.strip(), ""]
    if snapshot.next_action:
        lines += ["## Prochaine action", snapshot.next_action.strip(), ""]
    lines.append("## Tâches liées")
    lines += [_objective_task_line(task) for task in snapshot.tasks] or ["_Aucune tâche liée._"]
    summary = summarize_task_statuses([task.status for task in snapshot.tasks])
    frontmatter = {
        "type": "objectif", "status": status_label, "horizon": snapshot.horizon.lower(),
        "tasks_planned": summary.planned, "tasks_done": summary.done,
        "tags": ["tracker/objectif"], "source": TRACKER_SOURCE, "tracker_id": f"objectif:{snapshot.objective_id}",
    }
    tracker_id = f"objectif:{snapshot.objective_id}"
    projected_note = ProjectedNote(tracker_id, objective_note_path(snapshot.title), frontmatter, "\n".join(lines))
    return projected_note


def project_idea(snapshot: IdeaSnapshot) -> ProjectedNote:
    frontmatter = {
        "type": "idée", "date": snapshot.created_on.isoformat(),
        "tags": ["tracker/idée", *snapshot.tags], "source": TRACKER_SOURCE, "tracker_id": f"idée:{snapshot.note_id}",
    }
    body = f"# {snapshot.title}\n\n{snapshot.content.strip()}"
    tracker_id = f"idée:{snapshot.note_id}"
    projected_note = ProjectedNote(tracker_id, idea_note_path(snapshot.created_on.isoformat(), snapshot.title), frontmatter, body)
    return projected_note


def project_course(snapshot: CourseSnapshot, today: date) -> ProjectedNote:
    """Dates are generated; the user's own lecture notes go below the managed block."""
    upcoming = [deadline for deadline in snapshot.deadlines if deadline.day >= today]
    past = [deadline for deadline in snapshot.deadlines if deadline.day < today]
    lines = [f"# {snapshot.name}", "", "## Échéances à venir", *(_deadline_line(deadline) for deadline in upcoming)] if upcoming else [f"# {snapshot.name}", "", "## Échéances à venir", "_Aucune échéance à venir._"]
    if past:
        lines += ["", "## Échéances passées", *(_deadline_line(deadline) for deadline in past)]
    tracker_id = f"cours:{snapshot.course_id}"
    frontmatter = {"type": "cours", "tags": ["tracker/cours"], "source": TRACKER_SOURCE, "tracker_id": tracker_id}
    projected_note = ProjectedNote(tracker_id, course_note_path(snapshot.name), frontmatter, "\n".join(lines))
    return projected_note


def _deadline_line(deadline: DeadlineSnapshot) -> str:
    time_label = f" à {deadline.time}" if deadline.time else ""
    note_label = f" — {deadline.note}" if deadline.note else ""
    line = f"- {format_long_date(deadline.day)}{time_label} · **{deadline.kind_label}** : {deadline.title}{note_label}"
    return line


def _task_line(task: TaskSnapshot, objective_paths: dict[str, str]) -> str:
    checkbox = STATUS_CHECKBOXES.get(task.status, OPEN_CHECKBOX)
    line = f"- {checkbox} {task.title}"
    if task.objective_id and task.objective_id in objective_paths:
        line += f" · {wikilink(objective_paths[task.objective_id], task.objective_title or 'Objectif')}"
    if task.status == "NOT_DONE" and task.not_done_reason:
        line += f" — non fait : {task.not_done_reason}"
    return line


def _objective_task_line(task: TaskSnapshot) -> str:
    checkbox = STATUS_CHECKBOXES.get(task.status, OPEN_CHECKBOX)
    day_link = f" — {wikilink(journal_note_path(task.day.isoformat()), task.day.isoformat())}" if task.day else " — à planifier"
    line = f"- {checkbox} {task.title}{day_link}"
    return line


def _bullet_section(heading: str, entries: list[str]) -> list[str]:
    cleaned_entries = [entry.strip() for entry in entries if entry and entry.strip()]
    if not cleaned_entries:
        return []
    section_lines = ["", f"## {heading}", *(f"- {entry}" for entry in cleaned_entries)]
    return section_lines
