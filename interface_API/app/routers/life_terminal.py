from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..security import get_current_user
from ..core.dates import to_date_key
from ..core.life_terminal import get_life_terminal_data

router = APIRouter(prefix="/api/life-terminal", tags=["life-terminal"])


@router.get("")
def life_terminal(
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_life_terminal_data(db, user, date or to_date_key())
