"""Content and display titles for tasks with optional names."""

DESCRIPTION_TITLE_LENGTH = 80
DAY_TITLE = "Journée"


def has_task_content(title: str | None, description: str | None, is_day: bool) -> bool:
    return is_day or bool((title or "").strip() or (description or "").strip())


def resolve_task_title(title: str | None, description: str | None, is_day: bool) -> str:
    if is_day:
        return DAY_TITLE
    if (title or "").strip():
        return title.strip()
    summary = " ".join((description or "").split())
    if len(summary) > DESCRIPTION_TITLE_LENGTH:
        return summary[:DESCRIPTION_TITLE_LENGTH - 1].rstrip() + "…"
    return summary or "Sans titre"
