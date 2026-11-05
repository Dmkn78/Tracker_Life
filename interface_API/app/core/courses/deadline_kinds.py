"""Kinds of important dates and their labels (shared by the API, the calendar export and the vault)."""

from __future__ import annotations

from typing import Literal

DeadlineKind = Literal["exam", "assignment", "other"]

DEADLINE_KIND_LABELS: dict[str, str] = {"exam": "Examen", "assignment": "Rendu", "other": "Date importante"}
DEADLINE_KINDS: tuple[str, ...] = tuple(DEADLINE_KIND_LABELS)
