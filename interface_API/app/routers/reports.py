from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..security import get_current_user
from ..core.dates import get_iso_week_id
from ..core.reports import generate_weekly_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/week")
def weekly_report(
    week_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    week_id = week_id or get_iso_week_id()
    report = generate_weekly_report(db, user.id, week_id)
    return JSONResponse(
        report,
        headers={"Content-Disposition": f'attachment; filename="life-regime-{week_id}.json"'},
    )
