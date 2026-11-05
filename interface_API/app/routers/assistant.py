"""Authenticated, read-only task proposals and daily/weekly analysis."""

from __future__ import annotations

from datetime import date as Date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..contracts.assistant import (
    AssistantMode,
    AssistantPreviewRequest,
    AssistantPreviewResponse,
)
from ..core.ai.errors import AiProviderError
from ..core.ai_provider_store import resolve_active_connection
from ..core.assistant_preview import generate_preview
from ..ai_runtime import current_provider_runtime
from ..database import get_db
from ..models import DailyLog, Task, User
from ..security import get_current_user


router = APIRouter(prefix="/api/assistant", tags=["assistant"])
MAX_CONTEXT_TASKS = 100
MAX_CONTEXT_TEXT_CHARACTERS = 24000
LOCAL_CONTEXT_TEXT_CHARACTERS = 10000
MAX_CONTEXT_FIELD_CHARACTERS = 1500
LOG_NUMBER_FIELDS = (
    "energy", "productivity", "startFriction", "mentalFatigue", "physicalFatigue", "focusQuality",
    "workTimeMinutes", "distractionTimeMinutes", "trainingDone", "avoidedImportantTask",
    "calorieTarget", "caloriePercent", "estimatedSleepDelayMin", "executionScore", "stateScore", "riskScore",
)
LOG_TEXT_FIELDS = ("mainBlocker", "improvementTomorrow", "textSummary", "voiceTranscript")
LOG_LIST_FIELDS = ("wins", "topImprovements", "blockers", "tomorrowPriorities", "tags")


@router.post("/preview", response_model=AssistantPreviewResponse)
async def preview_assistant(
    body: AssistantPreviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssistantPreviewResponse:
    try:
        # Resolve the provider before reading private journal data.
        connection = resolve_active_connection(db, user.id, current_provider_runtime(), body.provider_id)
        start, end = analysis_period(body.date, body.mode)
        text_budget = LOCAL_CONTEXT_TEXT_CHARACTERS if connection.is_local else MAX_CONTEXT_TEXT_CHARACTERS
        context = build_analysis_context(user.id, body.date, body.mode, db, text_budget) if body.mode != "tasks" else {}
        proposal = await generate_preview(connection, body.prompt, body.date, body.mode, context)
        return AssistantPreviewResponse(analysis=proposal.analysis, tasks=proposal.tasks, from_date=start.isoformat(), to=end.isoformat())
    except AiProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


def analysis_period(date_key: str, mode: AssistantMode) -> tuple[Date, Date]:
    end = Date.fromisoformat(date_key)
    try:
        start = end - timedelta(days=6) if mode == "week" else end
    except OverflowError as error:
        raise AiProviderError(400, "La date sélectionnée ne permet pas de calculer cette période.") from error
    return start, end


def build_analysis_context(user_id: str, date_key: str, mode: AssistantMode, db: Session, text_budget: int = MAX_CONTEXT_TEXT_CHARACTERS) -> dict:
    """Only read the current user's persisted logs/tasks in the selected inclusive period."""
    start, end = analysis_period(date_key, mode)
    logs = list(db.scalars(select(DailyLog).where(
        DailyLog.userId == user_id, DailyLog.date >= start, DailyLog.date <= end,
    ).order_by(DailyLog.date.asc())))
    tasks = list(db.scalars(select(Task).where(
        Task.userId == user_id, Task.date >= start, Task.date <= end,
    ).order_by(Task.date.asc(), Task.sortOrder.asc(), Task.id.asc()).limit(MAX_CONTEXT_TASKS + 1)))
    logs_by_date = {log.date: log for log in logs}
    tasks_truncated = len(tasks) > MAX_CONTEXT_TASKS
    tasks = tasks[:MAX_CONTEXT_TASKS]
    text_truncated = False

    def bounded_text(text: str | None, maximum: int = MAX_CONTEXT_FIELD_CHARACTERS) -> str | None:
        nonlocal text_budget, text_truncated
        if text is None:
            return None
        retained = text[:min(maximum, text_budget)]
        text_budget -= len(retained)
        if len(retained) < len(text):
            text_truncated = True
            retained += " [texte tronqué]"
        return retained

    days: list[dict] = []
    for offset in range((end - start).days + 1):
        day_date = start + timedelta(days=offset)
        log = logs_by_date.get(day_date)
        log_context = None
        if log is not None:
            log_context = {"status": log.status, **{field: getattr(log, field) for field in LOG_NUMBER_FIELDS}}
            log_context.update({field: bounded_text(getattr(log, field)) for field in LOG_TEXT_FIELDS})
            for field in LOG_LIST_FIELDS:
                entries = getattr(log, field) or []
                log_context[field] = [bounded_text(entry, 200) for entry in entries[:5]]
                if len(entries) > 5:
                    text_truncated = True
        daily_tasks = [task for task in tasks if task.date == day_date]
        days.append({
            "date": day_date.isoformat(),
            "journalPresent": log is not None,
            "journal": log_context,
            "tasks": [{
                "title": bounded_text(task.title, 300), "description": bounded_text(task.description, 500),
                "startTime": bounded_text(task.startTime, 5), "endTime": bounded_text(task.endTime, 5), "estimatedMinutes": task.estimatedMinutes,
                "importance": task.importance.lower(), "productive": task.productive,
                "status": task.status.lower(), "completionPercent": task.completionPercent,
                "notDoneReason": bounded_text(task.notDoneReason, 500),
            } for task in daily_tasks],
        })
    return {
        "from": start.isoformat(), "to": end.isoformat(), "days": days,
        "tasksTruncated": tasks_truncated, "textTruncated": text_truncated,
        "taskLimit": MAX_CONTEXT_TASKS,
    }
