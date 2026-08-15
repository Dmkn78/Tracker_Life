from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..contracts.calendar_events import CalendarEventCreateRequest, CalendarEventUpdateRequest
from ..core.tags_companies import resolve_company_id
from ..database import get_db
from ..models import CalendarEvent, Company, User
from ..security import get_current_user
from ..core.dates import add_days, iso_datetime, parse_date_key, to_date_key, to_utc_naive
from ..core.scoring import recompute_around_date

router = APIRouter(prefix="/api/calendar-events", tags=["calendar-events"])


def serialize_event(db: Session, event: CalendarEvent | None) -> dict | None:
    if event is None:
        return None
    company = db.get(Company, event.companyId) if event.companyId else None
    return {
        "id": event.id,
        "userId": event.userId,
        "title": event.title,
        "type": event.type.lower(),
        "impact": event.impact.lower(),
        "start": iso_datetime(event.start),
        "end": iso_datetime(event.end),
        "expectedStress": event.expectedStress,
        "expectedPreparationLoad": event.expectedPreparationLoad,
        "companyId": event.companyId,
        "companyName": company.name if company else None,
        "companyColor": company.color if company else None,
        "createdAt": iso_datetime(event.createdAt),
        "updatedAt": iso_datetime(event.updatedAt),
    }


@router.get("")
def list_events(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    event_start: datetime | None = Query(default=None, alias="eventStart"),
    event_end_exclusive: datetime | None = Query(default=None, alias="eventEndExclusive"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start, end = resolve_event_range(from_, to, event_start, event_end_exclusive)
    events = list(
        db.execute(
            select(CalendarEvent)
            .where(CalendarEvent.userId == user.id, CalendarEvent.end > start, CalendarEvent.start < end)
            .order_by(CalendarEvent.start.asc())
        ).scalars()
    )
    return {"events": [serialize_event(db, event) for event in events]}


def resolve_event_range(from_, to, event_start, event_end_exclusive):
    if (event_start is None) != (event_end_exclusive is None):
        raise HTTPException(status_code=422, detail="eventStart and eventEndExclusive must be provided together")
    if event_start is not None:
        start = to_utc_naive(event_start)
        end = to_utc_naive(event_end_exclusive)
        if end <= start:
            raise HTTPException(status_code=422, detail="eventEndExclusive must be after eventStart")
        return start, end
    from_key = from_ or to_date_key()
    to_key = to or add_days(from_key, 30)
    return (
        datetime.combine(parse_date_key(from_key), time.min),
        datetime.combine(parse_date_key(add_days(to_key, 1)), time.min),
    )


@router.post("")
def create_event(
    body: CalendarEventCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start = to_utc_naive(body.start)
    end = to_utc_naive(body.end) if body.end else start + timedelta(hours=1)
    event = CalendarEvent(
        userId=user.id,
        title=body.title or "Untitled event",
        type=body.type.value,
        start=start,
        end=end,
        impact=body.impact.value,
        expectedStress=body.expected_stress,
        expectedPreparationLoad=body.expected_preparation_load,
        companyId=resolve_company_id(db, user.id, body.company_id, body.company_name),
    )
    db.add(event)
    db.flush()
    recompute_around_date(db, user.id, event.start.date().isoformat())
    return {"event": serialize_event(db, event)}


@router.patch("")
def update_event(
    body: CalendarEventUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(CalendarEvent).where(CalendarEvent.id == body.id, CalendarEvent.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Event not found")

    previous_start_key = existing.start.date().isoformat()
    next_start = to_utc_naive(body.start) if body.start else existing.start
    next_end = to_utc_naive(body.end) if body.end else existing.end
    if next_end < next_start:
        raise HTTPException(status_code=422, detail="Event end must be after its start")
    if body.title is not None:
        existing.title = body.title
    if body.type is not None:
        existing.type = body.type.value
    existing.start = next_start
    existing.end = next_end
    if body.impact is not None:
        existing.impact = body.impact.value
    if body.expected_stress is not None:
        existing.expectedStress = body.expected_stress
    if body.expected_preparation_load is not None:
        existing.expectedPreparationLoad = body.expected_preparation_load
    if "company_id" in body.model_fields_set or "company_name" in body.model_fields_set:
        existing.companyId = resolve_company_id(db, user.id, body.company_id, body.company_name)
    db.flush()
    recompute_around_date(db, user.id, previous_start_key)
    recompute_around_date(db, user.id, existing.start.date().isoformat())
    return {"event": serialize_event(db, existing)}


@router.delete("")
def delete_event(
    id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing event id")
    existing = db.execute(
        select(CalendarEvent).where(CalendarEvent.id == id, CalendarEvent.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Event not found")
    start_key = existing.start.date().isoformat()
    db.delete(existing)
    db.flush()
    recompute_around_date(db, user.id, start_key)
    return {"ok": True}
