"""Pure rules of the weekly board: which tasks count as done, open or dropped."""

from __future__ import annotations

from dataclasses import dataclass

DONE_STATUSES = frozenset({"DONE"})
DROPPED_STATUSES = frozenset({"NOT_DONE", "CANCELLED"})


@dataclass(frozen=True)
class WeekSummary:
    planned: int
    done: int
    dropped: int
    open: int

    @property
    def completion_rate(self) -> float:
        rate = self.done / self.planned if self.planned else 0.0
        return round(rate, 3)

    def to_json(self) -> dict:
        summary_json = {
            "planned": self.planned, "done": self.done, "dropped": self.dropped,
            "open": self.open, "completionRate": self.completion_rate,
        }
        return summary_json


def summarize_task_statuses(statuses: list[str]) -> WeekSummary:
    done_count = sum(1 for status in statuses if status in DONE_STATUSES)
    dropped_count = sum(1 for status in statuses if status in DROPPED_STATUSES)
    summary = WeekSummary(
        planned=len(statuses),
        done=done_count,
        dropped=dropped_count,
        open=len(statuses) - done_count - dropped_count,
    )
    return summary


def is_open_status(status: str) -> bool:
    return status not in DONE_STATUSES and status not in DROPPED_STATUSES
