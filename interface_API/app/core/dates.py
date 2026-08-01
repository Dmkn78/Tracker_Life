"""Date-key helpers ported from lib/dates.ts (keys are 'YYYY-MM-DD' strings)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

WEEKDAY_SHORT = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
WEEKDAY_LONG = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
MONTH_SHORT = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
MONTH_LONG = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


def to_date_key(value: date | None = None) -> str:
    return (value or date.today()).isoformat()


def parse_date_key(date_key: str) -> date:
    return date.fromisoformat(date_key[:10])


def add_days(date_key: str, days: int) -> str:
    return (parse_date_key(date_key) + timedelta(days=days)).isoformat()


def get_iso_week_id(date_key: str | None = None) -> str:
    day = parse_date_key(date_key) if date_key else date.today()
    iso_year, iso_week, _ = day.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def get_week_date_keys(week_id: str) -> list[str]:
    year_value, week_value = week_id.split("-W")
    monday = date.fromisocalendar(int(year_value), int(week_value), 1)
    return [(monday + timedelta(days=index)).isoformat() for index in range(7)]


def shift_week_id(week_id: str, offset: int) -> str:
    return get_iso_week_id(add_days(get_week_date_keys(week_id)[0], offset * 7))


def day_label(date_key: str) -> str:
    return WEEKDAY_SHORT[parse_date_key(date_key).weekday()]


def day_full_label(date_key: str) -> str:
    day = parse_date_key(date_key)
    return f"{WEEKDAY_LONG[day.weekday()]}, {MONTH_SHORT[day.month - 1]} {day.day}"


def month_year_label(date_key: str) -> str:
    day = parse_date_key(date_key)
    return f"{MONTH_LONG[day.month - 1]} {day.year}"


def event_time_label(value: datetime) -> str:
    hour = value.hour % 12 or 12
    suffix = "AM" if value.hour < 12 else "PM"
    return f"{hour:02d}:{value.minute:02d} {suffix}"


def iso_datetime(value: datetime | None) -> str | None:
    """Serialize a naive UTC datetime like Prisma/JS: 2026-01-01T00:00:00.000Z."""
    if value is None:
        return None
    return value.strftime("%Y-%m-%dT%H:%M:%S.") + f"{value.microsecond // 1000:03d}Z"


def parse_iso_datetime(value: str) -> datetime:
    """Parse an ISO string (with optional Z / offset) to a naive UTC datetime."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return to_utc_naive(parsed)


def to_utc_naive(value: datetime) -> datetime:
    """Normalize an aware datetime to naive UTC for the Prisma-owned schema."""
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)
