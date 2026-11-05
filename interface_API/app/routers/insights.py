"""Analysis of the user's history: deterministic patterns, cited AI answers, goal decomposition."""

from __future__ import annotations

import json
import time
from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..contracts.insights import GoalDecompositionRequest, InsightQuestionRequest
from ..core.ai.connection import StructuredPrompt
from ..core.ai.errors import AiProviderError
from ..core.ai.gateway import generate_validated
from ..core.ai_provider_store import resolve_active_connection
from ..core.insights.analysis_period import AnalysisPeriod, resolve_analysis_period, restrict_history
from ..core.insights.cited_answer import InsightAnswer, apply_citation_policy
from ..core.insights.evidence_catalog import LOCAL_EVIDENCE_CHARACTERS, MAX_EVIDENCE_CHARACTERS, build_evidence_catalog
from ..core.insights.goal_steps import GoalSteps
from ..core.insights.history_patterns import detect_history_patterns
from ..core.insights.insight_prompts import ANALYSIS_SYSTEM_PROMPT, DECOMPOSITION_SYSTEM_PROMPT
from ..core.knowledge.note_paths import TRACKER_FOLDER
from ..core.knowledge.search_index import SearchHit, SearchQuery, search_notes
from ..core.knowledge.tracker_snapshot import load_tracker_snapshot
from ..core.knowledge.vault_index_cache import load_search_index
from ..core.knowledge.vault_store import VaultStore
from ..ai_runtime import current_provider_runtime
from ..database import get_db
from ..models import Objective, Task, User
from .knowledge import get_vault_store
from ..security import get_current_user

router = APIRouter(prefix="/api/insights", tags=["insights"])
MAX_NOTE_EVIDENCE = 6
MAX_GOAL_CONTEXT_NOTES = 4
MAX_EXISTING_GOAL_TASKS = 30


@router.get("/patterns")
def get_patterns(
    date_from: Date | None = Query(default=None, alias="from"),
    date_to: Date | None = Query(default=None, alias="to"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    period = _resolve_period(date_from, date_to)
    history = restrict_history(load_tracker_snapshot(db, user.id), period)
    return {"period": period.to_json(), "patterns": detect_history_patterns(history).to_json()}


@router.post("/ask")
async def ask_history(
    body: InsightQuestionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    store: VaultStore = Depends(get_vault_store),
) -> dict:
    period = _resolve_period(body.date_from, body.date_to)
    try:
        connection = resolve_active_connection(db, user.id, current_provider_runtime(), body.provider_id)
        history = restrict_history(load_tracker_snapshot(db, user.id), period)
        patterns = detect_history_patterns(history)
        # A local model reads the prompt much more slowly: send it a smaller, most-recent-first selection.
        evidence_budget = LOCAL_EVIDENCE_CHARACTERS if connection.is_local else MAX_EVIDENCE_CHARACTERS
        note_hits = _search_personal_notes(store, body.question, MAX_NOTE_EVIDENCE)
        catalog = build_evidence_catalog(history, patterns, note_hits, evidence_budget)
        user_message = json.dumps({
            "question": body.question, "periode": period.to_json(), "sourcesTronquees": catalog.is_truncated,
            "sources": [{"id": item.id, "type": item.kind, "date": item.date, "titre": item.title, "contenu": item.text} for item in catalog.items],
        }, ensure_ascii=False)
        prompt = StructuredPrompt(ANALYSIS_SYSTEM_PROMPT, user_message, "history_analysis", InsightAnswer.model_json_schema())
        answer = await generate_validated(connection, prompt, InsightAnswer)
    except AiProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    checked_answer = apply_citation_policy(answer, set(catalog.by_id()))
    cited_sources = [item.to_json() for item in catalog.items if item.id in checked_answer.cited_ids()]
    return {
        "period": period.to_json(), "answer": checked_answer.to_json(), "sources": cited_sources,
        "evidenceCount": len(catalog.items), "isTruncated": catalog.is_truncated,
    }


@router.post("/decompose")
async def decompose_goal(
    body: GoalDecompositionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    store: VaultStore = Depends(get_vault_store),
) -> dict:
    """Return proposals only; nothing is created until the user accepts steps in the interface."""
    goal_title, goal_summary, existing_tasks = _load_goal_context(db, user.id, body)
    try:
        connection = resolve_active_connection(db, user.id, current_provider_runtime(), body.provider_id)
        related_notes = _search_personal_notes(store, f"{goal_title} {goal_summary or ''}", MAX_GOAL_CONTEXT_NOTES)
        user_message = json.dumps({
            "objectif": goal_title, "description": goal_summary, "tachesExistantes": existing_tasks,
            "notesLiees": [{"titre": hit.title, "extrait": hit.excerpt} for hit in related_notes],
        }, ensure_ascii=False)
        prompt = StructuredPrompt(DECOMPOSITION_SYSTEM_PROMPT, user_message, "goal_steps", GoalSteps.model_json_schema(), max_tokens=2048, temperature=0.4)
        steps = await generate_validated(connection, prompt, GoalSteps)
    except AiProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    return {"steps": [step.model_dump() for step in steps.steps], "basedOnNotes": [hit.path for hit in related_notes]}


def _resolve_period(date_from: Date | None, date_to: Date | None) -> AnalysisPeriod:
    try:
        period = resolve_analysis_period(date_from, date_to, Date.today())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return period


def _search_personal_notes(store: VaultStore, text: str, limit: int) -> list[SearchHit]:
    """The user's own notes only: tracker-generated notes duplicate the database records."""
    hits = search_notes(load_search_index(store), SearchQuery(text=text, now_timestamp=time.time(), limit=limit * 3))
    personal_hits = [hit for hit in hits if not hit.path.startswith(f"{TRACKER_FOLDER}/") and hit.score > 0][:limit]
    return personal_hits


def _load_goal_context(db: Session, user_id: str, body: GoalDecompositionRequest) -> tuple[str, str | None, list[str]]:
    if not body.objective_id:
        return (body.text or "").strip(), None, []
    objective = db.scalar(select(Objective).where(Objective.id == body.objective_id, Objective.userId == user_id))
    if objective is None:
        raise HTTPException(status_code=404, detail="Objectif introuvable.")
    existing_tasks = list(db.scalars(
        select(Task.title).where(Task.userId == user_id, Task.objectiveId == objective.id).limit(MAX_EXISTING_GOAL_TASKS)
    ))
    return objective.title, objective.summary, existing_tasks
