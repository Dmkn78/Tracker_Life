from datetime import date, timedelta
from uuid import NAMESPACE_URL, uuid5

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..contracts.objective_planning import ObjectivePlanRequest, ProgressCheckpointRequest, TaskPlanRequest, RecoveryRequest, PlanningDecisionRequest, ReallocationRequest, RecoveryScheduleRequest
from ..core.objective_analytics import Checkpoint, NetworkTask, critical_path, trajectory
from ..core.objective_planning_data import get_planning_data
from ..core.objective_progress import record_objective_progress, load_progress_inputs, rollup_progress
from ..database import get_db
from ..models import BlockRecovery, Objective, ObjectivePlan, ObjectiveProgressEntry, Task, TaskPlan, User, WeeklyPlanBlock
from ..security import get_current_user

router = APIRouter(prefix="/api/objectives/planning", tags=["objective planning"])


def owned_objective(db: Session, user_id: str, objective_id: str) -> Objective:
    objective = db.scalar(select(Objective).where(Objective.id == objective_id, Objective.userId == user_id, Objective.archived.is_(False)))
    if objective is None:
        raise HTTPException(404, "Objective not found")
    return objective


def owned_block(db: Session, user_id: str, block_id: str) -> WeeklyPlanBlock:
    block = db.scalar(select(WeeklyPlanBlock).where(WeeklyPlanBlock.id == block_id, WeeklyPlanBlock.userId == user_id).with_for_update())
    if block is None:
        raise HTTPException(404, "Block not found")
    return block


def objective_plan(db: Session, objective: Objective) -> ObjectivePlan:
    plan = db.get(ObjectivePlan, objective.id)
    if plan is None:
        plan = ObjectivePlan(objectiveId=objective.id, startDate=objective.createdAt.date())
        db.add(plan)
        db.flush()
    return plan


@router.get("")
def planning(month: str | None = Query(default=None), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        month_start = date.fromisoformat(f"{month}-01") if month else date.today().replace(day=1)
    except ValueError:
        raise HTTPException(400, "Use a month in YYYY-MM format")
    if not 1900 <= month_start.year <= 2100:
        raise HTTPException(400, "Month must be between 1900 and 2100")
    return get_planning_data(db, user.id, month_start)


@router.patch("/settings")
def save_plan(body: ObjectivePlanRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    objective = owned_objective(db, user.id, body.objective_id)
    if objective.targetDate and body.start_date > objective.targetDate:
        raise HTTPException(400, "Start date must precede the deadline")
    plan = objective_plan(db, objective)
    plan.startDate, plan.effortMinutes, plan.impact, plan.manualProgress = body.start_date, body.effort_minutes, body.impact, body.manual_progress
    record_objective_progress(db, user.id)
    return {"ok": True}


@router.post("/checkpoint")
def save_checkpoint(body: ProgressCheckpointRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    objective = owned_objective(db, user.id, body.objective_id)
    plan = objective_plan(db, objective)
    if body.date < plan.startDate:
        raise HTTPException(400, "The observation must be on or after the start date")
    if body.date == date.today():
        plan.manualProgress = body.progress
        record_objective_progress(db, user.id)
    statement = insert(ObjectiveProgressEntry).values(objectiveId=objective.id, date=body.date, progress=body.progress, source="manual")
    db.execute(statement.on_conflict_do_update(index_elements=[ObjectiveProgressEntry.objectiveId, ObjectiveProgressEntry.date], set_={"progress": body.progress, "source": "manual"}))
    return {"ok": True}


@router.patch("/task")
def save_task_plan(body: TaskPlanRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Serialize graph edits so concurrent requests cannot create a dependency cycle.
    db.execute(select(User.id).where(User.id == user.id).with_for_update()).scalar_one()
    task = db.scalar(select(Task).where(Task.id == body.task_id, Task.userId == user.id))
    if task is None or not task.objectiveId:
        raise HTTPException(404, "Linked task not found")
    owned_objective(db, user.id, task.objectiveId)
    tasks = list(db.scalars(select(Task).where(Task.userId == user.id, Task.objectiveId == task.objectiveId, Task.status != "CANCELLED")))
    if set(body.predecessor_ids) - {item.id for item in tasks}:
        raise HTTPException(400, "Dependencies must belong to the same objective")
    plans = {plan.taskId: plan for plan in db.scalars(select(TaskPlan).where(TaskPlan.taskId.in_([item.id for item in tasks])))}
    graph = [NetworkTask(item.id, item.title, 0, 1, 1, 1, tuple(body.predecessor_ids if item.id == task.id else plans[item.id].predecessorIds if item.id in plans else [])) for item in tasks]
    try:
        critical_path(graph)
    except ValueError as error:
        raise HTTPException(400, str(error))
    plan = plans.get(task.id)
    if plan is None:
        plan = TaskPlan(taskId=task.id)
        db.add(plan)
    plan.optimisticMinutes, plan.likelyMinutes, plan.pessimisticMinutes = body.optimistic_minutes, body.likely_minutes, body.pessimistic_minutes
    plan.predecessorIds = list(dict.fromkeys(body.predecessor_ids))
    task.estimatedMinutes = body.likely_minutes
    db.flush()
    return {"ok": True}


@router.post("/recovery")
def recover_block(body: RecoveryRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    block = owned_block(db, user.id, body.block_id)
    existing = db.get(BlockRecovery, block.id)
    if existing:
        if existing.action != body.action:
            raise HTTPException(409, "This block already has a recovery decision")
        return {"ok": True, "replacementId": existing.replacementId}
    if block.date > date.today() or block.executionStatus not in ("not_done", "partial"):
        raise HTTPException(400, "Record partial or not done execution before making a recovery decision")
    replacement = None
    if body.action == "replan":
        replacement = WeeklyPlanBlock(userId=user.id, objectiveId=block.objectiveId, title=block.title, category=block.category, date=body.date, durationMinutes=body.duration_minutes, flexible=True, note=f"Replanned from {block.date.isoformat()}")
        db.add(replacement)
        db.flush()
    db.add(BlockRecovery(blockId=block.id, action=body.action, replacementId=replacement.id if replacement else None))
    db.flush()
    return {"ok": True, "replacementId": replacement.id if replacement else None}


@router.post("/decision")
def decide(body: PlanningDecisionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    objective = owned_objective(db, user.id, body.objective_id)
    plan = objective_plan(db, objective)
    if body.action == "ignore":
        plan.ignoredUntil = date.today() + timedelta(days=7)
    elif body.action == "reduce_scope":
        current_effort = next(item["effortMinutes"] for item in get_planning_data(db, user.id, date.today().replace(day=1))["insights"] if item["objectiveId"] == objective.id)
        if not body.effort_minutes or not current_effort or body.effort_minutes >= current_effort:
            raise HTTPException(400, "Set an effort estimate first, then enter a smaller scope")
        plan.effortMinutes = body.effort_minutes
    else:
        objectives, tasks, plans = load_progress_inputs(db, user.id)
        progress = rollup_progress(objectives, tasks, plans)[objective.id]
        history = [Checkpoint(entry.date, entry.progress) for entry in db.scalars(select(ObjectiveProgressEntry).where(ObjectiveProgressEntry.objectiveId == objective.id))]
        forecast = trajectory(progress, history, objective.targetDate, date.today())["forecastDate"]
        if not forecast or not body.forecast_date or body.forecast_date.isoformat() != forecast:
            raise HTTPException(409, "The forecast changed or has insufficient observations. Refresh before accepting it.")
        objective.targetDate = body.forecast_date
    db.flush()
    return {"ok": True}


@router.post("/reallocate")
def reallocate(body: ReallocationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_objective(db, user.id, body.objective_id)
    block = owned_block(db, user.id, body.block_id)
    if block.date < date.today() or block.executionStatus != "planned":
        raise HTTPException(400, "Only unexecuted blocks from today onward can be reallocated")
    block.objectiveId = body.objective_id
    db.flush()
    return {"ok": True}


@router.post("/recovery-schedule")
def schedule_recovery(body: RecoveryScheduleRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    objective = owned_objective(db, user.id, body.objective_id)
    if objective.status in ("DONE", "PAUSED"):
        raise HTTPException(400, "Recovery requires an active objective")
    db.execute(select(User.id).where(User.id == user.id).with_for_update()).scalar_one()
    request_prefix = str(uuid5(NAMESPACE_URL, f"recovery:{user.id}:{body.request_id}"))
    existing = list(db.scalars(select(WeeklyPlanBlock).where(WeeklyPlanBlock.userId == user.id, WeeklyPlanBlock.id.like(f"{request_prefix}:%"))))
    if existing:
        matches = len(existing) == body.days and all(block.objectiveId == objective.id and block.durationMinutes == body.daily_minutes and block.date == body.start_date + timedelta(days=int(block.id.rsplit(":", 1)[1])) for block in existing)
        if not matches:
            raise HTTPException(409, "This scheduling request has already been used with a different plan")
        return {"ok": True}
    end_date = body.start_date + timedelta(days=body.days - 1)
    commitments = list(db.scalars(select(WeeklyPlanBlock).where(WeeklyPlanBlock.userId == user.id, WeeklyPlanBlock.date >= body.start_date, WeeklyPlanBlock.date <= end_date)))
    for offset in range(body.days):
        day = body.start_date + timedelta(days=offset)
        if sum(block.durationMinutes for block in commitments if block.date == day) + body.daily_minutes > 1440:
            raise HTTPException(400, f"Planned blocks would exceed 24 hours on {day.isoformat()}")
    for offset in range(body.days):
        db.add(WeeklyPlanBlock(id=f"{request_prefix}:{offset}", userId=user.id, objectiveId=objective.id, title=f"Recovery · {objective.title}", category="WORK", date=body.start_date + timedelta(days=offset), durationMinutes=body.daily_minutes, flexible=True, note="Recovery plan accepted by the user"))
    db.flush()
    return {"ok": True}
