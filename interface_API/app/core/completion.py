"""Record the first completion once; reopening cannot mint a second reward."""

from ..models import Objective, Task, utcnow


def record_completion(record: Task | Objective, previous_status: str | None) -> None:
    if record.status != "DONE" or previous_status == "DONE" or record.completedAt is not None:
        return
    record.completedAt = utcnow()
    if isinstance(record, Objective):
        record.completionDeadline = record.targetDate
