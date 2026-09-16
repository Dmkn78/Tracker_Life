from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..contracts.performance import BlockExecutionRequest, PerformanceTargetRequest, WorkSessionRequest
from ..core.performance import monday
from ..core.performance_data import get_performance_data
from ..core.performance_work import recorded_day_minutes
from ..database import get_db
from ..models import Objective, PerformanceWeek, User, WeeklyPlanBlock
from ..security import get_current_user

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.get("")
def get_performance(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return get_performance_data(db, user)


@router.patch("/target")
def update_target(body: PerformanceTargetRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    statement = insert(PerformanceWeek).values(userId=user.id, weekStart=monday(date.today()), targetMinutes=body.target_minutes)
    db.execute(statement.on_conflict_do_update(index_elements=["userId", "weekStart"], set_={"targetMinutes": body.target_minutes}))
    db.flush()
    return get_performance_data(db, user)


@router.post("/work")
def log_work(body: WorkSessionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    _lock_work_owner(db, user.id)
    request_id = str(body.request_id)
    existing = db.get(WeeklyPlanBlock, request_id)
    if existing:
        if existing.userId != user.id:
            raise HTTPException(409, "Session identifier is already in use")
        if (existing.title, existing.date, existing.actualMinutes, existing.objectiveId) != (body.title.strip(), body.date, body.actual_minutes, body.objective_id or None):
            raise HTTPException(409, "This request identifier belongs to a different session")
        return get_performance_data(db, user)
    if body.objective_id and not db.scalar(select(Objective.id).where(Objective.id == body.objective_id, Objective.userId == user.id)):
        raise HTTPException(400, "Invalid objectiveId")
    _validate_day_minutes(db, user.id, body.date, body.actual_minutes)
    db.add(WeeklyPlanBlock(id=request_id, userId=user.id, title=body.title.strip(), date=body.date,
                          objectiveId=body.objective_id or None, category="WORK", durationMinutes=0,
                          flexible=True, actualMinutes=body.actual_minutes, executionStatus="done"))
    db.flush()
    return get_performance_data(db, user)


@router.patch("/block")
def log_block(body: BlockExecutionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    _lock_work_owner(db, user.id)
    block = db.scalar(select(WeeklyPlanBlock).where(WeeklyPlanBlock.id == body.id, WeeklyPlanBlock.userId == user.id))
    if block is None:
        raise HTTPException(404, "Work block not found")
    if block.date > date.today() and body.execution_status != "planned":
        raise HTTPException(400, "Work cannot be logged in the future")
    _validate_day_minutes(db, user.id, block.date, body.actual_minutes or 0, block.id)
    block.executionStatus = body.execution_status
    block.actualMinutes = body.actual_minutes if body.execution_status in ("done", "partial") else None
    db.flush()
    return get_performance_data(db, user)


def _lock_work_owner(db: Session, user_id: str) -> None:
    db.execute(select(User.id).where(User.id == user_id).with_for_update()).scalar_one()


def _validate_day_minutes(db: Session, user_id: str, day: date, minutes: int, exclude_id: str | None = None) -> None:
    recorded = recorded_day_minutes(db, user_id, day, exclude_id)
    if recorded + minutes > 1440:
        raise HTTPException(400, "Recorded work cannot exceed 24 hours in one day")
