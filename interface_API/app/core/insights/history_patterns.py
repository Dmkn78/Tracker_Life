"""Deterministic patterns computed from recorded data only (no model, fully reproducible).

Every pattern lists the dated records it comes from, so the user can verify it.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass

from pydantic.alias_generators import to_camel

from ..knowledge.french_dates import WEEKDAYS
from ..knowledge.projected_notes import TaskSnapshot
from ..knowledge.text_tokens import tokenize
from ..week_board import DONE_STATUSES, summarize_task_statuses
from .analysis_period import PeriodHistory

MIN_RECURRENCE = 2
MAX_PATTERN_ITEMS = 8
MAX_EVIDENCE_PER_ITEM = 6
MIN_KEYWORD_LENGTH = 4


@dataclass(frozen=True)
class EvidenceRecord:
    date: str | None
    text: str


@dataclass(frozen=True)
class RecurringItem:
    label: str
    count: int
    done_count: int
    evidence: list[EvidenceRecord]


@dataclass(frozen=True)
class WeekdayRate:
    weekday: str
    planned: int
    done: int


@dataclass(frozen=True)
class ObjectiveActivity:
    title: str
    planned: int
    done: int


@dataclass(frozen=True)
class HistoryPatterns:
    planned: int
    done: int
    dropped: int
    open: int
    completion_rate: float
    days_with_recap: int
    day_count: int
    weekday_rates: list[WeekdayRate]
    recurring_tasks: list[RecurringItem]
    postponed_tasks: list[RecurringItem]
    recurring_blockers: list[RecurringItem]
    blocker_keywords: list[RecurringItem]
    objective_activity: list[ObjectiveActivity]
    idle_objectives: list[str]

    def to_json(self) -> dict:
        patterns_json = _camelize_keys(asdict(self))
        return patterns_json


def detect_history_patterns(history: PeriodHistory) -> HistoryPatterns:
    summary = summarize_task_statuses([task.status for task in history.tasks])
    blocker_records = _collect_blocker_records(history)
    patterns = HistoryPatterns(
        planned=summary.planned, done=summary.done, dropped=summary.dropped, open=summary.open,
        completion_rate=summary.completion_rate,
        days_with_recap=sum(1 for day in history.days if day.recap),
        day_count=history.period.day_count,
        weekday_rates=_weekday_rates(history.tasks),
        recurring_tasks=_recurring_tasks(history.tasks),
        postponed_tasks=_postponed_tasks(history.tasks),
        recurring_blockers=_group_by_normalized_text(blocker_records),
        blocker_keywords=_keyword_recurrences(blocker_records),
        objective_activity=_objective_activity(history.tasks),
        idle_objectives=_idle_objectives(history),
    )
    return patterns


def normalize_label(text: str) -> str:
    """Two labels are 'the same' when they share the same meaningful words, in any order."""
    normalized_label = " ".join(sorted(set(tokenize(text))))
    return normalized_label


def _weekday_rates(tasks: list[TaskSnapshot]) -> list[WeekdayRate]:
    planned_by_weekday: Counter = Counter()
    done_by_weekday: Counter = Counter()
    for task in tasks:
        if task.day is None:
            continue
        planned_by_weekday[task.day.weekday()] += 1
        done_by_weekday[task.day.weekday()] += task.status in DONE_STATUSES
    weekday_rates = [
        WeekdayRate(WEEKDAYS[weekday], planned_by_weekday[weekday], done_by_weekday[weekday])
        for weekday in range(7) if planned_by_weekday[weekday]
    ]
    return weekday_rates


def _recurring_tasks(tasks: list[TaskSnapshot]) -> list[RecurringItem]:
    records = [(task, EvidenceRecord(task.day.isoformat() if task.day else None, task.title)) for task in tasks]
    groups: dict[str, list[tuple[TaskSnapshot, EvidenceRecord]]] = defaultdict(list)
    for task, record in records:
        key = normalize_label(task.title)
        if key:
            groups[key].append((task, record))
    distinct_day_groups = [group for group in groups.values() if len({record.date for _, record in group}) >= MIN_RECURRENCE]
    recurring_items = [
        RecurringItem(group[0][0].title, len(group), sum(task.status in DONE_STATUSES for task, _ in group), [record for _, record in group][:MAX_EVIDENCE_PER_ITEM])
        for group in distinct_day_groups
    ]
    return _top_items(recurring_items)


def _postponed_tasks(tasks: list[TaskSnapshot]) -> list[RecurringItem]:
    """Tasks planned on several days and not done each time: the classic 'always postponed' signal."""
    postponed_items = [
        RecurringItem(item.label, item.count, item.done_count, item.evidence)
        for item in _recurring_tasks(tasks)
        if item.count - item.done_count >= MIN_RECURRENCE
    ]
    return postponed_items


def _collect_blocker_records(history: PeriodHistory) -> list[EvidenceRecord]:
    day_blockers = [EvidenceRecord(day.day.isoformat(), blocker) for day in history.days for blocker in day.blockers if blocker.strip()]
    not_done_reasons = [
        EvidenceRecord(task.day.isoformat() if task.day else None, f"{task.title} — {task.not_done_reason}")
        for task in history.tasks if task.status == "NOT_DONE" and task.not_done_reason
    ]
    blocker_records = [*day_blockers, *not_done_reasons]
    return blocker_records


def _group_by_normalized_text(records: list[EvidenceRecord]) -> list[RecurringItem]:
    groups: dict[str, list[EvidenceRecord]] = defaultdict(list)
    for record in records:
        key = normalize_label(record.text)
        if key:
            groups[key].append(record)
    grouped_items = [
        RecurringItem(group[0].text, len(group), 0, group[:MAX_EVIDENCE_PER_ITEM])
        for group in groups.values() if len(group) >= MIN_RECURRENCE
    ]
    return _top_items(grouped_items)


def _keyword_recurrences(records: list[EvidenceRecord]) -> list[RecurringItem]:
    records_by_keyword: dict[str, list[EvidenceRecord]] = defaultdict(list)
    for record in records:
        for keyword in set(tokenize(record.text)):
            if len(keyword) >= MIN_KEYWORD_LENGTH:
                records_by_keyword[keyword].append(record)
    keyword_items = [
        RecurringItem(keyword, len(keyword_records), 0, keyword_records[:MAX_EVIDENCE_PER_ITEM])
        for keyword, keyword_records in records_by_keyword.items() if len(keyword_records) >= MIN_RECURRENCE
    ]
    return _top_items(keyword_items)


def _objective_activity(tasks: list[TaskSnapshot]) -> list[ObjectiveActivity]:
    tasks_by_objective: dict[str, list[TaskSnapshot]] = defaultdict(list)
    for task in tasks:
        if task.objective_title:
            tasks_by_objective[task.objective_title].append(task)
    activity = [
        ObjectiveActivity(title, len(objective_tasks), sum(task.status in DONE_STATUSES for task in objective_tasks))
        for title, objective_tasks in tasks_by_objective.items()
    ]
    sorted_activity = sorted(activity, key=lambda item: -item.planned)
    return sorted_activity


def _idle_objectives(history: PeriodHistory) -> list[str]:
    active_titles = {task.objective_title for task in history.tasks if task.objective_title}
    idle_titles = [
        objective.title for objective in history.snapshot.objectives
        if objective.status not in {"DONE", "PAUSED"} and objective.title not in active_titles
    ]
    return idle_titles


def _top_items(items: list[RecurringItem]) -> list[RecurringItem]:
    top_items = sorted(items, key=lambda item: (-item.count, item.label))[:MAX_PATTERN_ITEMS]
    return top_items


def _camelize_keys(node: object) -> object:
    if isinstance(node, dict):
        return {to_camel(key): _camelize_keys(child) for key, child in node.items()}
    if isinstance(node, list):
        return [_camelize_keys(child) for child in node]
    return node
