"""SQLAlchemy models mapped onto the existing Prisma-managed tables.

Table, column and enum names mirror prisma/schema.prisma exactly so this API
shares the database with the current Next.js backend during the transition.
The schema stays owned by Prisma migrations; these models never create it.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base
from .ids import new_id

DAILY_LOG_STATUSES = ("EMPTY", "DRAFT", "SUBMITTED", "ANALYZED", "MISSING", "SKIPPED")
TASK_IMPORTANCES = ("LOW", "MEDIUM", "HIGH")
TASK_STATUSES = ("PLANNED", "IN_PROGRESS", "DONE", "POSTPONED", "CANCELLED")
CALENDAR_EVENT_TYPES = (
    "EXAM", "INTERVIEW", "DEADLINE", "ADMIN", "SOCIAL", "TRAINING", "RECOVERY", "TRAVEL", "PERSONAL",
)
CALENDAR_IMPACTS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
OBJECTIVE_KINDS = ("OBJECTIVE", "PROJECT", "MILESTONE")
OBJECTIVE_HORIZONS = ("YEAR", "QUARTER", "MONTH", "WEEK")
OBJECTIVE_STATUSES = ("PLANNED", "ACTIVE", "ON_TRACK", "AT_RISK", "PAUSED", "DONE")
OBJECTIVE_PRIORITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
WEEKLY_PLAN_CATEGORIES = ("WORK", "STUDY", "SPORT", "REST", "ADMIN", "PERSONAL", "SOCIAL", "TRAVEL")


def _enum(values: tuple[str, ...], name: str) -> ENUM:
    return ENUM(*values, name=name, create_type=False)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    label: Mapped[str] = mapped_column(String, nullable=False, default="Local user")
    calorieTarget: Mapped[int] = mapped_column(Integer, nullable=False, default=2200)
    defaultSleepDelayMin: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class DailyLog(Base):
    __tablename__ = "DailyLog"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(_enum(DAILY_LOG_STATUSES, "DailyLogStatus"), nullable=False, default="EMPTY")
    energy: Mapped[int | None] = mapped_column(Integer)
    productivity: Mapped[int | None] = mapped_column(Integer)
    startFriction: Mapped[int | None] = mapped_column(Integer)
    calorieTarget: Mapped[int | None] = mapped_column(Integer)
    caloriePercent: Mapped[int | None] = mapped_column(Integer)
    trainingDone: Mapped[bool | None] = mapped_column(Boolean)
    mentalFatigue: Mapped[int | None] = mapped_column(Integer)
    physicalFatigue: Mapped[int | None] = mapped_column(Integer)
    focusQuality: Mapped[int | None] = mapped_column(Integer)
    workTimeMinutes: Mapped[int | None] = mapped_column(Integer)
    distractionTimeMinutes: Mapped[int | None] = mapped_column(Integer)
    avoidedImportantTask: Mapped[bool | None] = mapped_column(Boolean)
    mainBlocker: Mapped[str | None] = mapped_column(Text)
    improvementTomorrow: Mapped[str | None] = mapped_column(Text)
    wins: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    topImprovements: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    blockers: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    tomorrowPriorities: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    customFields: Mapped[dict | None] = mapped_column(JSONB)
    sleepIntentClickedAt: Mapped[datetime | None] = mapped_column(DateTime)
    estimatedSleepDelayMin: Mapped[int | None] = mapped_column(Integer)
    estimatedSleepStart: Mapped[datetime | None] = mapped_column(DateTime)
    textSummary: Mapped[str | None] = mapped_column(Text)
    voiceTranscript: Mapped[str | None] = mapped_column(Text)
    executionScore: Mapped[int | None] = mapped_column(Integer)
    stateScore: Mapped[int | None] = mapped_column(Integer)
    riskScore: Mapped[int | None] = mapped_column(Integer)
    riskDelta: Mapped[int | None] = mapped_column(Integer)
    riskAcceleration: Mapped[int | None] = mapped_column(Integer)
    regime: Mapped[str | None] = mapped_column(Text)
    regimeConfidence: Mapped[int | None] = mapped_column(Integer)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)
    submittedAt: Mapped[datetime | None] = mapped_column(DateTime)


class Task(Base):
    __tablename__ = "Task"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    objectiveId: Mapped[str | None] = mapped_column(String)
    companyId: Mapped[str | None] = mapped_column(String)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    date: Mapped[date | None] = mapped_column(Date)
    startTime: Mapped[str | None] = mapped_column(Text)
    endTime: Mapped[str | None] = mapped_column(Text)
    importance: Mapped[str] = mapped_column(_enum(TASK_IMPORTANCES, "TaskImportance"), nullable=False, default="MEDIUM")
    productive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    estimatedMinutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completionPercent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(_enum(TASK_STATUSES, "TaskStatus"), nullable=False, default="PLANNED")
    sortOrder: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Company(Base):
    __tablename__ = "Company"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(Text, nullable=False, default="#8da2fb")
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Tag(Base):
    __tablename__ = "Tag"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(Text, nullable=False, default="#57c59a")
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class TaskTag(Base):
    __tablename__ = "TaskTag"

    taskId: Mapped[str] = mapped_column(String, primary_key=True)
    tagId: Mapped[str] = mapped_column(String, primary_key=True)


class ThinkingNote(Base):
    __tablename__ = "ThinkingNote"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    reminderAt: Mapped[datetime | None] = mapped_column(DateTime)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class ThinkingNoteTag(Base):
    __tablename__ = "ThinkingNoteTag"

    noteId: Mapped[str] = mapped_column(String, primary_key=True)
    tagId: Mapped[str] = mapped_column(String, primary_key=True)


class ThinkingNoteTask(Base):
    __tablename__ = "ThinkingNoteTask"

    noteId: Mapped[str] = mapped_column(String, primary_key=True)
    taskId: Mapped[str] = mapped_column(String, primary_key=True)


class TimeAllocationCategory(Base):
    __tablename__ = "TimeAllocationCategory"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    objective: Mapped[str | None] = mapped_column(Text)
    targetWeight: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expectedReturn: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    risk: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    beta: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    color: Mapped[str] = mapped_column(Text, nullable=False, default="#22d3ee")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class DailyTimeAllocation(Base):
    __tablename__ = "DailyTimeAllocation"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    categoryId: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    plannedMinutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    plannedMinutesManual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    actualMinutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    note: Mapped[str | None] = mapped_column(Text)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class DailyPlanningContext(Base):
    __tablename__ = "DailyPlanningContext"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    dayBudgetMinutes: Mapped[int] = mapped_column(Integer, nullable=False, default=720)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Habit(Base):
    __tablename__ = "Habit"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False, default="routine")
    description: Mapped[str | None] = mapped_column(Text)
    targetTime: Mapped[str | None] = mapped_column(Text)
    defaultExpectedMinutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sortOrder: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    source: Mapped[str] = mapped_column(Text, nullable=False, default="manual")
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class HabitCheckin(Base):
    __tablename__ = "HabitCheckin"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    habitId: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="planned")
    actualMinutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    note: Mapped[str | None] = mapped_column(Text)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class RoutineBlock(Base):
    __tablename__ = "RoutineBlock"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    habitId: Mapped[str | None] = mapped_column(String)
    dayType: Mapped[str] = mapped_column(Text, nullable=False, default="school_day")
    label: Mapped[str] = mapped_column(Text, nullable=False)
    startTime: Mapped[str] = mapped_column(Text, nullable=False)
    endTime: Mapped[str] = mapped_column(Text, nullable=False)
    sortOrder: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class CalendarEvent(Base):
    __tablename__ = "CalendarEvent"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    companyId: Mapped[str | None] = mapped_column(String)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(_enum(CALENDAR_EVENT_TYPES, "CalendarEventType"), nullable=False, default="PERSONAL")
    start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    impact: Mapped[str] = mapped_column(_enum(CALENDAR_IMPACTS, "CalendarImpact"), nullable=False, default="MEDIUM")
    expectedStress: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    expectedPreparationLoad: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class WeeklyReport(Base):
    __tablename__ = "WeeklyReport"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    weekId: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Objective(Base):
    __tablename__ = "Objective"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    parentId: Mapped[str | None] = mapped_column(String)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    nextAction: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(_enum(OBJECTIVE_KINDS, "ObjectiveKind"), nullable=False, default="OBJECTIVE")
    horizon: Mapped[str] = mapped_column(_enum(OBJECTIVE_HORIZONS, "ObjectiveHorizon"), nullable=False)
    status: Mapped[str] = mapped_column(_enum(OBJECTIVE_STATUSES, "ObjectiveStatus"), nullable=False, default="PLANNED")
    priority: Mapped[str] = mapped_column(_enum(OBJECTIVE_PRIORITIES, "ObjectivePriority"), nullable=False, default="MEDIUM")
    targetDate: Mapped[date | None] = mapped_column(Date)
    weekId: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str] = mapped_column(Text, nullable=False, default="#8da2fb")
    sortOrder: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class WeeklyPlanBlock(Base):
    __tablename__ = "WeeklyPlanBlock"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    objectiveId: Mapped[str | None] = mapped_column(String)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(_enum(WEEKLY_PLAN_CATEGORIES, "WeeklyPlanCategory"), nullable=False, default="WORK")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    startTime: Mapped[str | None] = mapped_column(Text)
    endTime: Mapped[str | None] = mapped_column(Text)
    durationMinutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    flexible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    note: Mapped[str | None] = mapped_column(Text)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)
