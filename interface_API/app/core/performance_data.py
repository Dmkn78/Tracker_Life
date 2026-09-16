"""Map persisted work and output to the performance calculation."""

from datetime import date, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import DailyLog, Objective, PerformanceWeek, Task, User, WeeklyPlanBlock
from .performance import OutputRecord, WorkRecord, build_performance


def get_performance_data(db: Session, user: User) -> dict:
    today = date.today()
    logs = db.scalars(select(DailyLog).where(DailyLog.userId == user.id, DailyLog.date <= today,
                      DailyLog.status.in_(("SUBMITTED", "ANALYZED")))).all()
    blocks = db.scalars(select(WeeklyPlanBlock).where(WeeklyPlanBlock.userId == user.id,
                        WeeklyPlanBlock.date <= today, WeeklyPlanBlock.category.in_(("WORK", "STUDY")))).all()
    tasks = db.scalars(select(Task).where(Task.userId == user.id, Task.productive.is_(True))).all()
    objectives = db.scalars(select(Objective).where(Objective.userId == user.id)).all()
    targets = db.scalars(select(PerformanceWeek).where(PerformanceWeek.userId == user.id)).all()
    work = [WorkRecord(log.date, log.workTimeMinutes or 0, "daily_log") for log in logs]
    work.extend(WorkRecord(block.date, block.actualMinutes or 0, "focus") for block in blocks
                if block.executionStatus in ("done", "partial"))
    outputs = []
    for task in tasks:
        if task.status == "DONE" and task.completedAt:
            outputs.append(OutputRecord(f"task:{task.id}", _completion_day(task.completedAt), task.title, "TASK", task.importance))
    for objective in objectives:
        if objective.status == "DONE" and objective.completedAt:
            completed_day = _completion_day(objective.completedAt)
            outputs.append(OutputRecord(f"objective:{objective.id}", completed_day, objective.title, objective.kind,
                                        objective.priority, bool(objective.completionDeadline and completed_day <= objective.completionDeadline)))
    planned = [(task.date, 2 if task.importance == "HIGH" else 1,
                1.0 if task.status == "DONE" else max(0, min(100, task.completionPercent)) / 100)
               for task in tasks if task.date and task.status not in ("CANCELLED", "POSTPONED")]
    result = build_performance(work, outputs, {row.weekStart: row.targetMinutes for row in targets}, today, planned)
    result["profileName"] = user.label
    result["undatedCompletions"] = sum(record.status == "DONE" and record.completedAt is None for record in [*tasks, *objectives])
    result["objectiveOptions"] = [{"id": objective.id, "title": objective.title} for objective in objectives if not objective.archived]
    result["recentSessions"] = [{"id": block.id, "date": block.date.isoformat(), "title": block.title,
                                  "actualMinutes": block.actualMinutes or 0, "executionStatus": block.executionStatus}
                                 for block in sorted(blocks, key=lambda row: (row.date, row.createdAt), reverse=True)
                                 if block.executionStatus in ("done", "partial")][:20]
    return result


def _completion_day(timestamp) -> date:
    # Existing timestamps are naive UTC; day keys follow the application's server timezone.
    return timestamp.replace(tzinfo=timezone.utc).astimezone().date()
