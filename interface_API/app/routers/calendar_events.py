from datetime import datetime, time, timedelta

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CalendarEvent, User
from ..security import get_current_user
from ..core.dates import add_days, iso_datetime, parse_date_key, parse_iso_datetime, to_date_key
from ..core.scoring import recompute_around_date

router = APIRouter(prefix="/api/calendar-events", tags=["calendar-events"])


def serialize_event(event: CalendarEvent | None) -> dict | None:
    if event is None:
        return None
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
        "createdAt": iso_datetime(event.createdAt),
        "updatedAt": iso_datetime(event.updatedAt),
    }


@router.get("")
def list_events(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from_key = from_ or to_date_key()
    to_key = to or add_days(from_key, 30)
    start = datetime.combine(parse_date_key(from_key), time.min)
    end = datetime.combine(parse_date_key(to_key), time.max)
    events = list(
        db.execute(
            select(CalendarEvent)
            .where(CalendarEvent.userId == user.id, CalendarEvent.start >= start, CalendarEvent.start < end)
            .order_by(CalendarEvent.start.asc())
        ).scalars()
    )
    return {"events": [serialize_event(event) for event in events]}


@router.post("")
def create_event(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start = parse_iso_datetime(body["start"])
    end = parse_iso_datetime(body["end"]) if body.get("end") else start + timedelta(hours=1)
    event = CalendarEvent(
        userId=user.id,
        title=body.get("title") or "Untitled event",
        type=str(body.get("type") or "PERSONAL").upper(),
        start=start,
        end=end,
        impact=str(body.get("impact") or "MEDIUM").upper(),
        expectedStress=body.get("expectedStress") if body.get("expectedStress") is not None else 50,
        expectedPreparationLoad=body.get("expectedPreparationLoad")
        if body.get("expectedPreparationLoad") is not None
        else 50,
    )
    db.add(event)
    db.flush()
    recompute_around_date(db, user.id, event.start.date().isoformat())
    return {"event": serialize_event(event)}


@router.patch("")
def update_event(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(CalendarEvent).where(CalendarEvent.id == body.get("id"), CalendarEvent.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Event not found"}, status_code=404)

    previous_start_key = existing.start.date().isoformat()
    if body.get("title") is not None:
        existing.title = body["title"]
    if body.get("type"):
        existing.type = str(body["type"]).upper()
    if body.get("start"):
        existing.start = parse_iso_datetime(body["start"])
    if body.get("end"):
        existing.end = parse_iso_datetime(body["end"])
    if body.get("impact"):
        existing.impact = str(body["impact"]).upper()
    if body.get("expectedStress") is not None:
        existing.expectedStress = body["expectedStress"]
    if body.get("expectedPreparationLoad") is not None:
        existing.expectedPreparationLoad = body["expectedPreparationLoad"]
    db.flush()
    recompute_around_date(db, user.id, previous_start_key)
    recompute_around_date(db, user.id, existing.start.date().isoformat())
    return {"event": serialize_event(existing)}


@router.delete("")
def delete_event(
    id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        return JSONResponse({"error": "Missing event id"}, status_code=400)
    existing = db.execute(
        select(CalendarEvent).where(CalendarEvent.id == id, CalendarEvent.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        return JSONResponse({"error": "Event not found"}, status_code=404)
    start_key = existing.start.date().isoformat()
    db.delete(existing)
    db.flush()
    recompute_around_date(db, user.id, start_key)
    return {"ok": True}
