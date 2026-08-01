from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.history import get_history_data
from ..database import get_db
from ..models import User
from ..security import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
def get_history(
    filter: Literal["last7", "last30", "week", "all"] = Query(default="last30"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_history_data(db, user.id, filter)
