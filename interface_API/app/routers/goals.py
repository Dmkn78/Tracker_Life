"""Lean goal list for the simple Goals screen (writes reuse /api/objectives and /api/tasks)."""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.week_board import DONE_STATUSES, is_open_status
from ..database import get_db
from ..models import Objective, Task, User
from ..security import get_current_user

router = APIRouter(prefix="/api/goals", tags=["goals"])
MAX_OPEN_TASKS_SHOWN = 5
FINISHED_GOAL_STATUS = "DONE"


@router.get("")
def list_goals(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    objectives = list(db.scalars(
        select(Objective)
        .where(Objective.userId == user.id, Objective.archived.is_(False), Objective.kind != "MILESTONE")
        .order_by(Objective.sortOrder.asc(), Objective.createdAt.asc())
    ))
    tasks_by_objective: dict[str, list[Task]] = defaultdict(list)
    for task in db.scalars(select(Task).where(Task.userId == user.id, Task.objectiveId.is_not(None)).order_by(Task.date.asc().nulls_last(), Task.createdAt.asc())):
        tasks_by_objective[task.objectiveId].append(task)
    goals = [_serialize_goal(objective, tasks_by_objective.get(objective.id, [])) for objective in objectives]
    ordered_goals = sorted(goals, key=lambda goal: goal["isDone"])
    return {"goals": ordered_goals}


def _serialize_goal(objective: Objective, tasks: list[Task]) -> dict:
    open_tasks = [task for task in tasks if is_open_status(task.status)]
    goal = {
        "id": objective.id,
        "title": objective.title,
        "summary": objective.summary,
        "isDone": objective.status == FINISHED_GOAL_STATUS,
        "tasksDone": sum(1 for task in tasks if task.status in DONE_STATUSES),
        "tasksTotal": len(tasks),
        "openTasks": [
            {"id": task.id, "title": task.title, "date": task.date.isoformat() if task.date else None}
            for task in open_tasks[:MAX_OPEN_TASKS_SHOWN]
        ],
    }
    return goal
