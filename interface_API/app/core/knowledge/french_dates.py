"""French date labels for generated notes (the vault is written in the user's language)."""

from __future__ import annotations

from datetime import date

WEEKDAYS = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
MONTHS = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre")


def format_long_date(day: date) -> str:
    long_date = f"{WEEKDAYS[day.weekday()]} {day.day} {MONTHS[day.month - 1]} {day.year}"
    return long_date


def format_short_date(day: date) -> str:
    short_date = f"{WEEKDAYS[day.weekday()]} {day.day} {MONTHS[day.month - 1]}"
    return short_date
