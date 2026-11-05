"""Projection of tracked data into the vault: idempotent, never deletes, never overwrites user text."""

from __future__ import annotations

from dataclasses import dataclass, field

from .managed_block import merge_managed_note
from .markdown_note import parse_note
from .note_paths import TRACKER_FOLDER
from datetime import date

from .projected_notes import ProjectedNote, project_course, project_day, project_idea, project_objective, project_week
from .tracker_snapshot import TrackerSnapshot
from .vault_store import VaultStore


@dataclass
class SyncReport:
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    conflicts: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        report_json = {"created": self.created, "updated": self.updated, "unchanged": self.unchanged, "conflicts": self.conflicts}
        return report_json


def sync_tracker_notes(store: VaultStore, snapshot: TrackerSnapshot) -> SyncReport:
    store.ensure_exists()
    existing_paths = find_managed_note_paths(store)
    used_paths = set(existing_paths.values())
    objective_notes = [project_objective(objective) for objective in snapshot.objectives]
    objective_paths = {
        note.tracker_id.removeprefix("objectif:"): _assign_path(note, existing_paths, used_paths)
        for note in objective_notes
    }
    other_notes = [
        *(project_day(day, objective_paths) for day in snapshot.days),
        *(project_week(week_id, days, snapshot.week_recaps.get(week_id)) for week_id, days in snapshot.days_by_week().items()),
        *(project_idea(idea) for idea in snapshot.ideas),
        *(project_course(course, date.today()) for course in snapshot.courses),
    ]
    note_paths = {note.tracker_id: objective_paths[note.tracker_id.removeprefix("objectif:")] for note in objective_notes}
    note_paths.update({note.tracker_id: _assign_path(note, existing_paths, used_paths) for note in other_notes})
    report = SyncReport()
    for note in [*objective_notes, *other_notes]:
        _write_projected_note(store, note, note_paths[note.tracker_id], report)
    return report


def find_managed_note_paths(store: VaultStore) -> dict[str, str]:
    """Map tracker_id → current path, so renamed or moved notes keep being updated in place."""
    managed_paths: dict[str, str] = {}
    for vault_file in store.list_markdown_files():
        if not vault_file.relative_path.startswith(f"{TRACKER_FOLDER}/"):
            continue
        tracker_id = parse_note(store.read_text(vault_file.relative_path) or "").frontmatter.get("tracker_id")
        if isinstance(tracker_id, str) and tracker_id not in managed_paths:
            managed_paths[tracker_id] = vault_file.relative_path
    return managed_paths


def _assign_path(note: ProjectedNote, existing_paths: dict[str, str], used_paths: set[str]) -> str:
    existing_path = existing_paths.get(note.tracker_id)
    if existing_path is not None:
        return existing_path
    candidate_path = note.preferred_path
    if candidate_path in used_paths:
        short_identifier = note.tracker_id.split(":", 1)[-1][-6:]
        candidate_path = note.preferred_path.removesuffix(".md") + f" ({short_identifier}).md"
    used_paths.add(candidate_path)
    return candidate_path


def _write_projected_note(store: VaultStore, note: ProjectedNote, note_path: str, report: SyncReport) -> None:
    outcome = merge_managed_note(store.read_text(note_path), note.frontmatter, note.body)
    if outcome.kind == "conflict":
        report.conflicts.append(note_path)
        return
    if outcome.kind == "unchanged":
        report.unchanged += 1
        return
    store.write_atomic(note_path, outcome.text)
    if outcome.kind == "created":
        report.created += 1
    else:
        report.updated += 1
