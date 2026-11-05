"""iCalendar (RFC 5545) export of important dates, importable by Google Agenda and phone calendars.

Times are written as *floating* local times (no time zone), because the app stores local dates
and times like tasks: the calendar shows them at the same wall-clock time on the user's device.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from .deadline_kinds import DEADLINE_KIND_LABELS

ICS_LINE_LIMIT = 75
PRODUCT_ID = "-//Life Regime//Cours et échéances//FR"


@dataclass(frozen=True)
class CalendarDeadline:
    uid: str
    title: str
    kind: str
    day: date
    time: str | None
    duration_minutes: int
    course_name: str | None
    note: str | None


def build_ics_calendar(deadlines: list[CalendarDeadline], generated_at: datetime) -> str:
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", f"PRODID:{PRODUCT_ID}", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Cours et échéances"]
    for deadline in deadlines:
        lines += _event_lines(deadline, generated_at)
    lines.append("END:VCALENDAR")
    calendar_text = "\r\n".join(_fold(line) for line in lines) + "\r\n"
    return calendar_text


def build_event_summary(deadline: CalendarDeadline) -> str:
    kind_label = DEADLINE_KIND_LABELS.get(deadline.kind, DEADLINE_KIND_LABELS["other"])
    course_prefix = f"{deadline.course_name} · " if deadline.course_name else ""
    summary = f"{kind_label} — {course_prefix}{deadline.title}"
    return summary


def _event_lines(deadline: CalendarDeadline, generated_at: datetime) -> list[str]:
    lines = ["BEGIN:VEVENT", f"UID:{deadline.uid}@life-regime", f"DTSTAMP:{generated_at.strftime('%Y%m%dT%H%M%SZ')}"]
    if deadline.time is None:
        lines += [f"DTSTART;VALUE=DATE:{deadline.day.strftime('%Y%m%d')}", f"DTEND;VALUE=DATE:{(deadline.day + timedelta(days=1)).strftime('%Y%m%d')}"]
    else:
        hours, minutes = (int(part) for part in deadline.time.split(":"))
        start = datetime(deadline.day.year, deadline.day.month, deadline.day.day, hours, minutes)
        end = start + timedelta(minutes=max(deadline.duration_minutes, 1))
        lines += [f"DTSTART:{start.strftime('%Y%m%dT%H%M%S')}", f"DTEND:{end.strftime('%Y%m%dT%H%M%S')}"]
    lines.append(f"SUMMARY:{_escape(build_event_summary(deadline))}")
    if deadline.note:
        lines.append(f"DESCRIPTION:{_escape(deadline.note)}")
    lines += ["BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D", f"DESCRIPTION:{_escape(build_event_summary(deadline))}", "END:VALARM", "END:VEVENT"]
    return lines


def _escape(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")
    return escaped


def _fold(line: str) -> str:
    """Lines longer than 75 octets continue on the next line, prefixed by a space (RFC 5545 §3.1)."""
    encoded = line.encode("utf-8")
    if len(encoded) <= ICS_LINE_LIMIT:
        return line
    parts: list[str] = []
    current = b""
    for character in line:
        encoded_character = character.encode("utf-8")
        limit = ICS_LINE_LIMIT if not parts else ICS_LINE_LIMIT - 1
        if len(current) + len(encoded_character) > limit:
            parts.append(current.decode("utf-8"))
            current = b""
        current += encoded_character
    parts.append(current.decode("utf-8"))
    folded_line = "\r\n ".join(parts)
    return folded_line
