"""Progress rollups and observed daily checkpoints, shared by every objective view."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..models import Objective, ObjectivePlan, ObjectiveProgressEntry, Task


def task_progress(task: Task) -> int:
    return 100 if task.status == "DONE" else task.completionPercent


def rollup_progress(objectives: list[Objective], tasks: list[Task], plans: dict[str, ObjectivePlan]) -> dict[str, int]:
    objective_map = {objective.id: objective for objective in objectives}
    children: dict[str, list[str]] = {}
    direct: dict[str, list[int]] = {}
    for objective in objectives:
        if objective.parentId in objective_map:
            children.setdefault(objective.parentId, []).append(objective.id)
    for task in tasks:
        if task.objectiveId and task.status != "CANCELLED":
            direct.setdefault(task.objectiveId, []).append(task_progress(task))
    progress: dict[str, int] = {}

    def visit(objective_id: str, trail: frozenset[str]) -> int:
        if objective_id in progress:
            return progress[objective_id]
        if objective_id in trail:
            return 0
        objective = objective_map[objective_id]
        plan = plans.get(objective_id)
        contributions = direct.get(objective_id, []) + [visit(child, trail | {objective_id}) for child in children.get(objective_id, [])]
        if objective.status == "DONE":
            result = 100
        elif plan and plan.manualProgress is not None:
            result = plan.manualProgress
        else:
            result = int(sum(contributions) / len(contributions) + 0.5) if contributions else 0
        progress[objective_id] = result
        return result

    for objective in objectives:
        visit(objective.id, frozenset())
    return progress


def load_progress_inputs(db: Session, user_id: str):
    objectives = list(db.scalars(select(Objective).where(Objective.userId == user_id, Objective.archived.is_(False))))
    tasks = list(db.scalars(select(Task).where(Task.userId == user_id)))
    plans = {plan.objectiveId: plan for plan in db.scalars(select(ObjectivePlan).join(Objective, Objective.id == ObjectivePlan.objectiveId).where(Objective.userId == user_id))}
    return objectives, tasks, plans


def record_objective_progress(db: Session, user_id: str) -> None:
    db.flush()
    objectives, tasks, plans = load_progress_inputs(db, user_id)
    progress = rollup_progress(objectives, tasks, plans)
    if not progress:
        return
    statement = insert(ObjectiveProgressEntry).values([
        {"objectiveId": objective_id, "date": date.today(), "progress": value, "source": "execution"}
        for objective_id, value in progress.items()
    ])
    db.execute(statement.on_conflict_do_update(
        index_elements=[ObjectiveProgressEntry.objectiveId, ObjectiveProgressEntry.date],
        set_={"progress": statement.excluded.progress, "source": statement.excluded.source},
    ))
