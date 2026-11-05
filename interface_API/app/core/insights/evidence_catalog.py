"""Numbered, traceable evidence given to the model. Every AI statement must cite these ids."""

from __future__ import annotations

from dataclasses import asdict, dataclass

from ..knowledge.french_dates import format_long_date
from ..knowledge.note_paths import journal_note_path, week_note_path
from ..knowledge.projected_notes import DaySnapshot
from ..knowledge.search_index import SearchHit
from ..week_board import summarize_task_statuses
from .analysis_period import PeriodHistory
from .history_patterns import HistoryPatterns

MAX_EVIDENCE_CHARACTERS = 30_000
LOCAL_EVIDENCE_CHARACTERS = 12_000
MAX_EVIDENCE_TEXT = 1_500
STATUS_WORDS = {"DONE": "fait", "NOT_DONE": "non fait", "CANCELLED": "annulé", "POSTPONED": "reporté", "IN_PROGRESS": "en cours"}


@dataclass(frozen=True)
class Evidence:
    id: str
    kind: str
    date: str | None
    title: str
    text: str
    path: str | None

    def to_json(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class EvidenceCatalog:
    items: list[Evidence]
    is_truncated: bool

    def by_id(self) -> dict[str, Evidence]:
        return {item.id: item for item in self.items}


def build_evidence_catalog(
    history: PeriodHistory,
    patterns: HistoryPatterns,
    note_hits: list[SearchHit],
    max_characters: int = MAX_EVIDENCE_CHARACTERS,
) -> EvidenceCatalog:
    """Most recent records are kept first when the budget is reached; the model is told about it."""
    candidates = [
        _statistics_evidence(patterns),
        *(_week_evidence(week_id, text) for week_id, text in sorted(history.week_recaps.items(), reverse=True)),
        *(_day_evidence(day) for day in sorted(history.days, key=lambda day: day.day, reverse=True)),
        *(_note_evidence(hit) for hit in note_hits),
    ]
    kept_items: list[Evidence] = []
    used_characters = 0
    for candidate in candidates:
        if used_characters + len(candidate.text) > max_characters:
            continue
        used_characters += len(candidate.text)
        kept_items.append(candidate)
    numbered_items = [Evidence(f"S{position}", *_fields_without_id(item)) for position, item in enumerate(kept_items, start=1)]
    catalog = EvidenceCatalog(items=numbered_items, is_truncated=len(kept_items) < len(candidates))
    return catalog


def _statistics_evidence(patterns: HistoryPatterns) -> Evidence:
    lines = [
        f"Tâches prévues {patterns.planned}, faites {patterns.done}, abandonnées {patterns.dropped}, encore ouvertes {patterns.open} "
        f"(taux de réalisation {round(patterns.completion_rate * 100)} %).",
        f"Jours avec récapitulatif : {patterns.days_with_recap} sur {patterns.day_count}.",
        *(f"{rate.weekday} : {rate.done}/{rate.planned} faites." for rate in patterns.weekday_rates),
        *(f"Tâche récurrente : « {item.label} » ×{item.count} ({item.done_count} faites)." for item in patterns.recurring_tasks),
        *(f"Tâche reportée plusieurs fois : « {item.label} » ({item.count - item.done_count} fois non faite)." for item in patterns.postponed_tasks),
        *(f"Blocage récurrent : « {item.label} » ×{item.count}." for item in patterns.recurring_blockers),
        *(f"Mot fréquent dans les blocages : « {item.label} » ×{item.count}." for item in patterns.blocker_keywords),
        *(f"Objectif « {item.title} » : {item.done}/{item.planned} tâches faites." for item in patterns.objective_activity),
        *(f"Objectif sans tâche sur la période : « {title} »." for title in patterns.idle_objectives),
    ]
    return Evidence("", "statistiques", None, "Statistiques calculées", _bounded("\n".join(lines)), None)


def _day_evidence(day: DaySnapshot) -> Evidence:
    date_key = day.day.isoformat()
    summary = summarize_task_statuses([task.status for task in day.tasks])
    task_lines = [f"- {task.title} ({STATUS_WORDS.get(task.status, 'prévu')})" for task in day.tasks]
    parts = [
        f"Récapitulatif : {day.recap}" if day.recap else "Pas de récapitulatif.",
        f"Tâches {summary.done}/{summary.planned} faites :" if day.tasks else "Aucune tâche.",
        *task_lines,
        *(f"Blocage : {blocker}" for blocker in day.blockers),
        *(f"Réussite : {win}" for win in day.wins),
    ]
    return Evidence("", "journal", date_key, f"Journal du {format_long_date(day.day)}", _bounded("\n".join(parts)), journal_note_path(date_key))


def _week_evidence(week_id: str, recap_text: str) -> Evidence:
    return Evidence("", "semaine", None, f"Récapitulatif de la semaine {week_id}", _bounded(recap_text), week_note_path(week_id))


def _note_evidence(hit: SearchHit) -> Evidence:
    return Evidence("", "note", hit.date_key, hit.title, _bounded(hit.excerpt), hit.path)


def _fields_without_id(item: Evidence) -> tuple:
    fields = (item.kind, item.date, item.title, item.text, item.path)
    return fields


def _bounded(text: str) -> str:
    bounded_text = text if len(text) <= MAX_EVIDENCE_TEXT else text[:MAX_EVIDENCE_TEXT] + " [tronqué]"
    return bounded_text
