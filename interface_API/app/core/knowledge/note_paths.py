"""Where tracker-generated notes live in the vault, and how they link to each other."""

from __future__ import annotations

import re

TRACKER_FOLDER = "Tracker"
JOURNAL_FOLDER = f"{TRACKER_FOLDER}/Journal"
WEEK_FOLDER = f"{TRACKER_FOLDER}/Semaines"
OBJECTIVE_FOLDER = f"{TRACKER_FOLDER}/Objectifs"
IDEA_FOLDER = f"{TRACKER_FOLDER}/Idées"
INBOX_FOLDER = "Inbox"
MAX_SLUG_LENGTH = 80
# Characters Obsidian refuses in file names, plus those that break wikilinks.
FORBIDDEN_FILENAME_CHARACTERS = re.compile(r'[\\/:*?"<>|#^\[\]\n\r\t]+')


def journal_note_path(date_key: str) -> str:
    return f"{JOURNAL_FOLDER}/{date_key}.md"


def week_note_path(week_id: str) -> str:
    return f"{WEEK_FOLDER}/{week_id}.md"


def objective_note_path(title: str) -> str:
    return f"{OBJECTIVE_FOLDER}/{slugify_title(title)}.md"


def idea_note_path(date_key: str, title: str) -> str:
    return f"{IDEA_FOLDER}/{date_key} {slugify_title(title)}.md"


def inbox_note_path(timestamp_key: str, title: str) -> str:
    return f"{INBOX_FOLDER}/{timestamp_key} {slugify_title(title)}.md"


def slugify_title(title: str) -> str:
    """Keep accents and spaces (readable in Obsidian), drop characters that break file names or links."""
    cleaned_title = FORBIDDEN_FILENAME_CHARACTERS.sub(" ", title)
    collapsed_title = " ".join(cleaned_title.split()).strip(" .")
    slug = collapsed_title[:MAX_SLUG_LENGTH].rstrip(" .") or "Sans titre"
    return slug


def wikilink(note_path: str, label: str) -> str:
    """Path-qualified links stay unambiguous even if the user has notes with the same name."""
    target = note_path.removesuffix(".md")
    safe_label = label.replace("|", "-").replace("]", ")").replace("[", "(")
    link = f"[[{target}|{safe_label}]]"
    return link
