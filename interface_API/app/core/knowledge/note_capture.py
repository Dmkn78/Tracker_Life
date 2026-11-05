"""Quick capture: one free-text field becomes a new Inbox note with automatic metadata."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .markdown_note import extract_hashtags, parse_note, render_frontmatter
from .note_paths import INBOX_FOLDER, inbox_note_path
from .vault_store import VaultStore

CAPTURE_TITLE_LENGTH = 70


@dataclass(frozen=True)
class CapturedNote:
    relative_path: str
    text: str
    title: str


def build_captured_note(raw_text: str, captured_at: datetime, capture_id: str | None = None) -> CapturedNote:
    """The first line becomes the title; hashtags become YAML tags. Nothing else is asked."""
    text = raw_text.strip()
    first_line = text.split("\n", 1)[0].lstrip("# ").strip()
    title = first_line[:CAPTURE_TITLE_LENGTH].rstrip() + ("…" if len(first_line) > CAPTURE_TITLE_LENGTH else "")
    frontmatter = {
        "type": "note",
        "created": captured_at.isoformat(timespec="minutes"),
        "date": captured_at.date().isoformat(),
        "tags": ["inbox", *extract_hashtags(text)],
        "source": "tracker-capture",
    }
    if capture_id:
        frontmatter["capture_id"] = capture_id
    body = _build_capture_body(text, title)
    timestamp_key = captured_at.strftime("%Y-%m-%d %H%M")
    captured_note = CapturedNote(inbox_note_path(timestamp_key, title), render_frontmatter(frontmatter) + "\n" + body, title)
    return captured_note


def _build_capture_body(text: str, title: str) -> str:
    if text.startswith("#"):
        return text + "\n"
    is_title_only = "\n" not in text and title == text
    body = f"# {title}\n" if is_title_only else f"# {title}\n\n{text}\n"
    return body


def find_captured_note_path(store: VaultStore, capture_id: str) -> str | None:
    """A retried capture is recognised by the id stored in its frontmatter (Inbox only)."""
    for vault_file in store.list_markdown_files():
        if not vault_file.relative_path.startswith(f"{INBOX_FOLDER}/"):
            continue
        if parse_note(store.read_text(vault_file.relative_path) or "").frontmatter.get("capture_id") == capture_id:
            return vault_file.relative_path
    return None
