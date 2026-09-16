"""Read model for roadmap, execution, objective details and decision support."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import BlockRecovery, ObjectiveProgressEntry, TaskPlan, WeeklyPlanBlock
from .objective_analytics import Checkpoint, NetworkTask, critical_path, expected_progress, trajectory
from .objective_progress import load_progress_inputs, rollup_progress, task_progress
from .objectives import serialize_block, serialize_task


def get_planning_data(db: Session, user_id: str, month: date) -> dict:
    today = date.today()
    next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    objectives, tasks, plans = load_progress_inputs(db, user_id)
    objective_map = {objective.id: objective for objective in objectives}
    progress = rollup_progress(objectives, tasks, plans)
    blocks = list(db.scalars(select(WeeklyPlanBlock).where(WeeklyPlanBlock.userId == user_id).order_by(WeeklyPlanBlock.date, WeeklyPlanBlock.startTime)))
    checkpoints = list(db.scalars(select(ObjectiveProgressEntry).where(ObjectiveProgressEntry.objectiveId.in_(objective_map)).order_by(ObjectiveProgressEntry.date)))
    task_plans = {plan.taskId: plan for plan in db.scalars(select(TaskPlan).where(TaskPlan.taskId.in_([task.id for task in tasks])))}
    recoveries = {item.blockId: item for item in db.scalars(select(BlockRecovery).where(BlockRecovery.blockId.in_([block.id for block in blocks])))}

    def descendants(objective_id: str) -> set[str]:
        found = {objective_id}
        pending = [objective_id]
        while pending:
            parent_id = pending.pop()
            for objective in objectives:
                if objective.parentId == parent_id and objective.id not in found:
                    found.add(objective.id)
                    pending.append(objective.id)
        return found

    insights = []
    for objective in objectives:
        plan = plans.get(objective.id)
        scope = descendants(objective.id)
        linked_tasks = [task for task in tasks if task.objectiveId in scope and task.status != "CANCELLED"]
        linked_blocks = [block for block in blocks if block.objectiveId in scope]
        history = [Checkpoint(entry.date, entry.progress) for entry in checkpoints if entry.objectiveId == objective.id]
        start = plan.startDate if plan else objective.createdAt.date()
        expected = expected_progress(start, objective.targetDate, today)
        metrics = trajectory(progress[objective.id], history, objective.targetDate, today)
        effort = plan.effortMinutes if plan and plan.effortMinutes else sum(task.estimatedMinutes for task in linked_tasks)
        actual = sum(block.actualMinutes or 0 for block in linked_blocks if block.executionStatus in ("done", "partial") and block.date <= today)
        month_blocks = [block for block in linked_blocks if month <= block.date < next_month]
        observed_blocks = [block for block in linked_blocks if today - timedelta(days=13) <= block.date <= today and block.executionStatus != "planned"]
        completion_rate = round(100 * sum(block.executionStatus == "done" for block in observed_blocks) / len(observed_blocks)) if observed_blocks else None
        gap = round(progress[objective.id] - expected, 1) if expected is not None else None
        deadline_health = max(0, min(100, 100 + (gap or 0))) if expected is not None else None
        health_parts = [value for value in (deadline_health, completion_rate) if value is not None]
        network_tasks = []
        task_ids = {task.id for task in linked_tasks}
        for task in linked_tasks:
            task_plan = task_plans.get(task.id)
            network_tasks.append(NetworkTask(task.id, task.title, task_progress(task),
                task_plan.optimisticMinutes if task_plan else task.estimatedMinutes,
                task_plan.likelyMinutes if task_plan else task.estimatedMinutes,
                task_plan.pessimisticMinutes if task_plan else task.estimatedMinutes,
                tuple(parent for parent in task_plan.predecessorIds if parent in task_ids) if task_plan else ()))
        network = critical_path(network_tasks)
        recovery_minutes = round(max(0, -(gap or 0)) * effort / 100) if effort else None
        remaining_days = max(1, (objective.targetDate - today).days) if objective.targetDate else 7
        recovery_days = min(7, remaining_days)
        insights.append({
            "objectiveId": objective.id, "progress": progress[objective.id],
            "objectiveIds": sorted(scope),
            "progressMode": "manual" if plan and plan.manualProgress is not None else "linked",
            "startDate": start.isoformat(), "effortMinutes": effort,
            "impact": plan.impact if plan else 50, "expectedProgress": expected,
            "gap": gap, **metrics,
            "health": round(sum(health_parts) / len(health_parts)) if health_parts else None,
            "executionRate": completion_rate, "actualMinutes": actual,
            "plannedMonthMinutes": sum(block.durationMinutes for block in month_blocks),
            "actualMonthMinutes": sum(block.actualMinutes or 0 for block in month_blocks if block.executionStatus in ("done", "partial") and block.date <= today),
            "recoveryMinutes": recovery_minutes, "recoveryDays": recovery_days,
            "recoveryDailyMinutes": (recovery_minutes + recovery_days - 1) // recovery_days if recovery_minutes else 0,
            "ignoredUntil": plan.ignoredUntil.isoformat() if plan and plan.ignoredUntil else None,
            "history": [{"date": point.day.isoformat(), "progress": point.progress} for point in history],
            "taskIds": [task.id for task in linked_tasks], "network": network,
        })

    candidates = [item for item in insights if objective_map[item["objectiveId"]].status not in ("DONE", "PAUSED") and (not item["ignoredUntil"] or item["ignoredUntil"] < today.isoformat())]
    candidates.sort(key=lambda item: (item["gap"] if item["gap"] is not None else 0, -item["impact"]))
    recommendations = []
    for item in candidates:
        if item["progress"] >= 100:
            continue
        if item["gap"] is not None and item["gap"] < -10:
            reason = "behind"
        elif not item["taskIds"]:
            reason = "decompose"
        elif item["plannedMonthMinutes"] == 0:
            reason = "allocate"
        else:
            continue
        recommendations.append({"objectiveId": item["objectiveId"], "reason": reason})
        if len(recommendations) == 4:
            break
    weeks = []
    cursor = month - timedelta(days=month.weekday())
    while cursor < next_month:
        weeks.append({"start": cursor.isoformat(), "end": (cursor + timedelta(days=6)).isoformat(), "label": f"W{cursor.isocalendar().week}"})
        cursor += timedelta(days=7)
    return {
        "today": today.isoformat(), "month": month.strftime("%Y-%m"), "weeks": weeks,
        "insights": insights, "recommendations": recommendations,
        "blocks": [{**serialize_block(block, objective_map.get(block.objectiveId)),
                    "recoveryAction": recoveries[block.id].action if block.id in recoveries else None,
                    "replacementId": recoveries[block.id].replacementId if block.id in recoveries else None}
                   for block in blocks if month <= block.date < next_month],
        "tasks": [{**serialize_task(task),
                   "optimisticMinutes": task_plans[task.id].optimisticMinutes if task.id in task_plans else task.estimatedMinutes,
                   "likelyMinutes": task_plans[task.id].likelyMinutes if task.id in task_plans else task.estimatedMinutes,
                   "pessimisticMinutes": task_plans[task.id].pessimisticMinutes if task.id in task_plans else task.estimatedMinutes,
                   "predecessorIds": [parent for parent in task_plans[task.id].predecessorIds if parent in {item.id for item in tasks}] if task.id in task_plans else []}
                  for task in tasks if task.status != "CANCELLED"],
    }
