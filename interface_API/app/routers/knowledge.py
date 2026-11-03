"""Second brain: sync tracked data to the vault, capture notes, search and read them."""

from __future__ import annotations

import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import get_settings
from ..contracts.knowledge import NoteCaptureRequest
from ..core.knowledge.markdown_note import parse_note
from ..core.knowledge.note_capture import build_captured_note
from ..core.knowledge.note_paths import TRACKER_FOLDER
from ..core.knowledge.search_index import SearchQuery, search_notes
from ..core.knowledge.tracker_snapshot import load_tracker_snapshot
from ..core.knowledge.vault_index_cache import load_search_index
from ..core.knowledge.vault_store import VaultPathError, VaultStore
from ..core.knowledge.vault_sync import sync_tracker_notes
from ..database import get_db
from ..models import User
from ..security import get_current_user

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])
MAX_SEARCH_RESULTS = 50


def get_vault_store() -> VaultStore:
    return VaultStore(get_settings().knowledge_vault_dir)


@router.get("/status")
def vault_status(user: User = Depends(get_current_user), store: VaultStore = Depends(get_vault_store)) -> dict:
    vault_files = store.list_markdown_files()
    managed_count = sum(1 for vault_file in vault_files if vault_file.relative_path.startswith(f"{TRACKER_FOLDER}/"))
    return {"vaultPath": str(store.root), "exists": store.root.is_dir(), "noteCount": len(vault_files), "managedCount": managed_count}


@router.post("/sync")
def sync_vault(user: User = Depends(get_current_user), db: Session = Depends(get_db), store: VaultStore = Depends(get_vault_store)) -> dict:
    report = sync_tracker_notes(store, load_tracker_snapshot(db, user.id))
    return {"report": report.to_json()}


@router.get("/search")
def search_vault(
    q: str = Query(default="", max_length=500),
    note_type: list[str] = Query(default=[], alias="type"),
    date_from: str | None = Query(default=None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(default=None, alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    limit: int = Query(default=20, ge=1, le=MAX_SEARCH_RESULTS),
    user: User = Depends(get_current_user),
    store: VaultStore = Depends(get_vault_store),
) -> dict:
    query = SearchQuery(text=q, now_timestamp=time.time(), note_types=frozenset(note_type), date_from=date_from, date_to=date_to, limit=limit)
    hits = search_notes(load_search_index(store), query)
    return {"results": [hit.__dict__ for hit in hits]}


@router.post("/notes")
def capture_note(body: NoteCaptureRequest, user: User = Depends(get_current_user), store: VaultStore = Depends(get_vault_store)) -> dict:
    captured_note = build_captured_note(body.text, datetime.now())
    store.ensure_exists()
    created_path = store.create_new(captured_note.relative_path, captured_note.text)
    return {"path": created_path, "title": captured_note.title}


@router.get("/note")
def read_note(path: str = Query(min_length=1, max_length=1000), user: User = Depends(get_current_user), store: VaultStore = Depends(get_vault_store)) -> dict:
    """Read-only view; editing happens in Obsidian (or any editor), never silently here."""
    try:
        text = store.read_text(path)
    except VaultPathError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if text is None:
        raise HTTPException(status_code=404, detail="Note introuvable.")
    parsed = parse_note(text)
    search_index = load_search_index(store)
    linked_paths = sorted(search_index.neighbors.get(path, frozenset()))
    linked_notes = [{"path": linked_path, "title": search_index.documents[linked_path].title} for linked_path in linked_paths]
    return {"path": path, "frontmatter": parsed.frontmatter, "body": parsed.body, "links": linked_notes}
