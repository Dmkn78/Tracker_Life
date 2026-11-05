"""Courses and important dates, with an iCalendar export for Google Agenda and phone calendars."""

from __future__ import annotations

from datetime import date as Date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..contracts.courses import CourseCreateRequest, CourseUpdateRequest, DeadlineCreateRequest, DeadlineUpdateRequest
from ..core.courses.calendar_export import CalendarDeadline, build_ics_calendar
from ..database import get_db
from ..models import Course, CourseDeadline, User
from ..security import get_current_user

router = APIRouter(prefix="/api/courses", tags=["courses"])
# Recent past deadlines stay visible for a while, then only upcoming ones are listed.
PAST_DEADLINE_DAYS = 30
COURSE_COLORS = ("#8da2fb", "#57c59a", "#f2b84b", "#ef7d7d", "#b48cf2", "#4cc3d9")


@router.get("")
def list_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    courses = list(db.scalars(select(Course).where(Course.userId == user.id).order_by(Course.archived.asc(), Course.createdAt.asc())))
    since = Date.today() - timedelta(days=PAST_DEADLINE_DAYS)
    deadlines = list(db.scalars(
        select(CourseDeadline).where(CourseDeadline.userId == user.id, CourseDeadline.date >= since)
        .order_by(CourseDeadline.date.asc(), CourseDeadline.time.asc().nulls_first())
    ))
    return {"courses": [_serialize_course(course) for course in courses], "deadlines": [_serialize_deadline(deadline) for deadline in deadlines], "today": Date.today().isoformat()}


@router.post("")
def create_course(body: CourseCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    course_count = len(list(db.scalars(select(Course.id).where(Course.userId == user.id))))
    course = Course(userId=user.id, name=body.name.strip(), color=body.color or COURSE_COLORS[course_count % len(COURSE_COLORS)])
    db.add(course)
    db.flush()
    return {"course": _serialize_course(course)}


@router.patch("")
def update_course(body: CourseUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    course = _load_course(db, user.id, body.id)
    if body.name is not None:
        course.name = body.name.strip()
    if body.color is not None:
        course.color = body.color
    if body.archived is not None:
        course.archived = body.archived
    db.flush()
    return {"course": _serialize_course(course)}


@router.delete("")
def delete_course(id: str = Query(min_length=1), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    course = _load_course(db, user.id, id)
    db.execute(delete(CourseDeadline).where(CourseDeadline.courseId == course.id, CourseDeadline.userId == user.id))
    db.delete(course)
    db.flush()
    return {"ok": True}


@router.post("/deadlines")
def create_deadline(body: DeadlineCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if body.course_id:
        _load_course(db, user.id, body.course_id)
    deadline = CourseDeadline(
        userId=user.id, courseId=body.course_id or None, title=body.title.strip(), kind=body.kind,
        date=body.date, time=body.time, durationMinutes=body.duration_minutes, note=(body.note or "").strip() or None,
    )
    db.add(deadline)
    db.flush()
    return {"deadline": _serialize_deadline(deadline)}


@router.patch("/deadlines")
def update_deadline(body: DeadlineUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    deadline = _load_deadline(db, user.id, body.id)
    provided_fields = body.model_fields_set
    if "course_id" in provided_fields:
        if body.course_id:
            _load_course(db, user.id, body.course_id)
        deadline.courseId = body.course_id or None
    if body.title is not None:
        deadline.title = body.title.strip()
    if body.kind is not None:
        deadline.kind = body.kind
    if body.date is not None:
        deadline.date = body.date
    if "time" in provided_fields:
        deadline.time = body.time
    if body.duration_minutes is not None:
        deadline.durationMinutes = body.duration_minutes
    if "note" in provided_fields:
        deadline.note = (body.note or "").strip() or None
    db.flush()
    return {"deadline": _serialize_deadline(deadline)}


@router.delete("/deadlines")
def delete_deadline(id: str = Query(min_length=1), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    db.delete(_load_deadline(db, user.id, id))
    db.flush()
    return {"ok": True}


@router.get("/calendar.ics")
def export_calendar(course_id: str | None = Query(default=None, alias="courseId"), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    """Upcoming dates as an .ics file: importable in Google Agenda or opened by the phone's calendar."""
    courses_by_id = {course.id: course for course in db.scalars(select(Course).where(Course.userId == user.id))}
    query = select(CourseDeadline).where(CourseDeadline.userId == user.id, CourseDeadline.date >= Date.today()).order_by(CourseDeadline.date.asc())
    if course_id:
        _load_course(db, user.id, course_id)
        query = query.where(CourseDeadline.courseId == course_id)
    calendar_deadlines = [_to_calendar_deadline(deadline, courses_by_id.get(deadline.courseId or "")) for deadline in db.scalars(query)]
    calendar_text = build_ics_calendar(calendar_deadlines, datetime.now(timezone.utc))
    return Response(calendar_text, media_type="text/calendar; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="cours-echeances.ics"'})


def _load_course(db: Session, user_id: str, course_id: str) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.userId == user_id))
    if course is None:
        raise HTTPException(status_code=404, detail="Cours introuvable.")
    return course


def _load_deadline(db: Session, user_id: str, deadline_id: str) -> CourseDeadline:
    deadline = db.scalar(select(CourseDeadline).where(CourseDeadline.id == deadline_id, CourseDeadline.userId == user_id))
    if deadline is None:
        raise HTTPException(status_code=404, detail="Échéance introuvable.")
    return deadline


def _serialize_course(course: Course) -> dict:
    return {"id": course.id, "name": course.name, "color": course.color, "archived": course.archived}


def _serialize_deadline(deadline: CourseDeadline) -> dict:
    serialized_deadline = {
        "id": deadline.id, "courseId": deadline.courseId, "title": deadline.title, "kind": deadline.kind,
        "date": deadline.date.isoformat(), "time": deadline.time, "durationMinutes": deadline.durationMinutes, "note": deadline.note,
    }
    return serialized_deadline


def _to_calendar_deadline(deadline: CourseDeadline, course: Course | None) -> CalendarDeadline:
    calendar_deadline = CalendarDeadline(
        uid=deadline.id, title=deadline.title, kind=deadline.kind, day=deadline.date, time=deadline.time,
        duration_minutes=deadline.durationMinutes, course_name=course.name if course else None, note=deadline.note,
    )
    return calendar_deadline
