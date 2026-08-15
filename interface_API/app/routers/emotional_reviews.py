from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..contracts.emotional_reviews import EmotionalReviewUpsertRequest, validate_iso_week_id
from ..core.dates import get_iso_week_id, iso_datetime
from ..database import get_db
from ..models import EmotionalReview, User, utcnow
from ..security import get_current_user

router = APIRouter(prefix="/api/emotional-reviews", tags=["emotional-reviews"])


def week_start(week_id: str) -> date:
    year_value, week_value = week_id.split("-W")
    return date.fromisocalendar(int(year_value), int(week_value), 1)


def serialize_review(review: EmotionalReview | None) -> dict | None:
    if review is None:
        return None
    return {
        "id": review.id,
        "weekId": review.weekId,
        "weekStart": review.weekStart.isoformat(),
        "emotions": review.emotions or [],
        "factors": review.factors or [],
        "stressLevel": review.stressLevel,
        "triggers": review.triggers or [],
        "mentalSignals": review.mentalSignals or [],
        "physicalSignals": review.physicalSignals or [],
        "whatHelped": review.whatHelped or [],
        "nextWeekAction": review.nextWeekAction or "",
        "notes": review.notes or "",
        "createdAt": iso_datetime(review.createdAt),
        "updatedAt": iso_datetime(review.updatedAt),
    }


@router.get("")
def get_emotional_review(
    week: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    week_id = week or get_iso_week_id()
    # Use the same validation path as writes, without accepting malformed query values.
    try:
        validated_week_id = validate_iso_week_id(week_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    review = db.execute(
        select(EmotionalReview).where(
            EmotionalReview.userId == user.id,
            EmotionalReview.weekId == validated_week_id,
        )
    ).scalar_one_or_none()
    return {"review": serialize_review(review), "weekId": validated_week_id}


@router.post("")
def upsert_emotional_review(
    body: EmotionalReviewUpsertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    values = {
        "weekStart": week_start(body.week_id),
        "emotions": [emotion.model_dump() for emotion in body.emotions],
        "factors": body.factors,
        "stressLevel": body.stress_level,
        "triggers": body.triggers,
        "mentalSignals": body.mental_signals,
        "physicalSignals": body.physical_signals,
        "whatHelped": body.what_helped,
        "nextWeekAction": body.next_week_action.strip() if body.next_week_action else None,
        "notes": body.notes.strip() if body.notes else None,
    }
    insert_statement = insert(EmotionalReview).values(userId=user.id, weekId=body.week_id, **values)
    db.execute(
        insert_statement.on_conflict_do_update(
            index_elements=[EmotionalReview.userId, EmotionalReview.weekId],
            set_={**values, "updatedAt": utcnow()},
        )
    )
    db.flush()
    review = db.execute(
        select(EmotionalReview).where(
            EmotionalReview.userId == user.id,
            EmotionalReview.weekId == body.week_id,
        )
    ).scalar_one()
    return {"review": serialize_review(review), "weekId": body.week_id}
