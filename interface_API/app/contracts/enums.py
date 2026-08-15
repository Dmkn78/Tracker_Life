"""Case-insensitive API enums mapped to the database enum values."""

from __future__ import annotations

from enum import Enum


class CaseInsensitiveEnum(str, Enum):
    @classmethod
    def _missing_(cls, raw_value: object):
        if not isinstance(raw_value, str):
            return None

        normalized_value = raw_value.upper()
        return next(
            (member for member in cls if member.value.upper() == normalized_value),
            None,
        )


class DailyLogStatus(CaseInsensitiveEnum):
    EMPTY = "EMPTY"
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    ANALYZED = "ANALYZED"
    MISSING = "MISSING"
    SKIPPED = "SKIPPED"


class TaskImportance(CaseInsensitiveEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class TaskStatus(CaseInsensitiveEnum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    NOT_DONE = "NOT_DONE"
    POSTPONED = "POSTPONED"
    CANCELLED = "CANCELLED"


class CalendarEventType(CaseInsensitiveEnum):
    EXAM = "EXAM"
    INTERVIEW = "INTERVIEW"
    DEADLINE = "DEADLINE"
    ADMIN = "ADMIN"
    SOCIAL = "SOCIAL"
    TRAINING = "TRAINING"
    RECOVERY = "RECOVERY"
    TRAVEL = "TRAVEL"
    PERSONAL = "PERSONAL"


class CalendarImpact(CaseInsensitiveEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ObjectiveKind(CaseInsensitiveEnum):
    OBJECTIVE = "OBJECTIVE"
    PROJECT = "PROJECT"
    MILESTONE = "MILESTONE"


class ObjectiveHorizon(CaseInsensitiveEnum):
    YEAR = "YEAR"
    QUARTER = "QUARTER"
    MONTH = "MONTH"
    WEEK = "WEEK"


class ObjectiveStatus(CaseInsensitiveEnum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    ON_TRACK = "ON_TRACK"
    AT_RISK = "AT_RISK"
    PAUSED = "PAUSED"
    DONE = "DONE"


class ObjectivePriority(CaseInsensitiveEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class WeeklyPlanCategory(CaseInsensitiveEnum):
    WORK = "WORK"
    STUDY = "STUDY"
    SPORT = "SPORT"
    REST = "REST"
    ADMIN = "ADMIN"
    PERSONAL = "PERSONAL"
    SOCIAL = "SOCIAL"
    TRAVEL = "TRAVEL"
