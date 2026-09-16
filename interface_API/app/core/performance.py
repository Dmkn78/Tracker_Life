"""Deterministic performance rules. All money is a fictional work-value unit."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

DEFAULT_WEEKLY_MINUTES = 2400
WORK_CENTS_PER_MINUTE = 20
TASK_CENTS = {"LOW": 100, "MEDIUM": 100, "HIGH": 200}
OBJECTIVE_CENTS = {"MILESTONE": 500, "OBJECTIVE": 1000, "PROJECT": 2500}
DEADLINE_BONUS_CENTS = 200
FOCUS_BONUS_MINUTES = 90
FOCUS_BONUS_CENTS = 100
PRODUCTIVE_DAY_MINUTES = 60
PRODUCTIVE_DAY_TASKS = 3
STREAK_BONUS_DAYS = 7
STREAK_BONUS_CENTS = 500
STATUS_TIERS = (
    ("Foundation", 0, 0), ("Established", 100000, 7),
    ("Proven", 500000, 30), ("Distinguished", 2000000, 90),
    ("Principal", 6000000, 180),
)


@dataclass(frozen=True)
class WorkRecord:
    day: date
    minutes: int
    source: str  # daily_log or focus


@dataclass(frozen=True)
class OutputRecord:
    id: str
    day: date
    title: str
    kind: str  # TASK, OBJECTIVE, PROJECT, MILESTONE
    priority: str = "MEDIUM"
    on_time: bool = False


def monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def build_performance(work: list[WorkRecord], outputs: list[OutputRecord],
                      targets: dict[date, int], today: date,
                      planned_tasks: list[tuple[date, int, float]]) -> dict:
    days: dict[date, dict] = defaultdict(_empty_day)
    for entry in work:
        if entry.day <= today:
            days[entry.day][entry.source] += max(0, entry.minutes)
    rewards = []
    for output in {entry.id: entry for entry in outputs}.values():
        if output.day > today:
            continue
        daily = days[output.day]
        is_task = output.kind == "TASK"
        daily["tasks" if is_task else "objectives"] += 1
        cents = TASK_CENTS.get(output.priority, TASK_CENTS["MEDIUM"]) if is_task else OBJECTIVE_CENTS[output.kind]
        if output.on_time and not is_task:
            cents += DEADLINE_BONUS_CENTS
        daily["capitalCents"] += cents
        rewards.append(_reward(output.id, output.day, output.title,
                               "Completed task" if is_task else "Delivered objective" + (" · on time" if output.on_time else ""), cents))

    run = 0
    previous_day = None
    for day, daily in sorted(days.items()):
        # Daily logs are totals, so focus already included in them is not paid twice.
        daily["minutes"] = min(1440, max(daily["daily_log"], daily["focus"]))
        daily["focus"] = min(1440, daily["focus"])
        daily["productive"] = daily["minutes"] >= PRODUCTIVE_DAY_MINUTES or daily["tasks"] >= PRODUCTIVE_DAY_TASKS or daily["objectives"] > 0
        run = (run + 1 if previous_day == day - timedelta(days=1) else 1) if daily["productive"] else 0
        daily["streak"] = run
        previous_day = day
        work_cents = daily["minutes"] * WORK_CENTS_PER_MINUTE
        if work_cents:
            daily["capitalCents"] += work_cents
            rewards.append(_reward(f"work:{day}", day, "Productive work", f'{daily["minutes"]} min recorded · €{WORK_CENTS_PER_MINUTE * 60 / 100:g}/h', work_cents))
        for earned, key, title, reason, cents in (
            (daily["focus"] >= FOCUS_BONUS_MINUTES, "focus", "Focus premium", "90+ minutes of focused work in one day", FOCUS_BONUS_CENTS),
            (run > 0 and run % STREAK_BONUS_DAYS == 0, "consistency", "Consistency dividend", "7 consecutive productive days", STREAK_BONUS_CENTS),
        ):
            if earned:
                daily["capitalCents"] += cents
                rewards.append(_reward(f"{key}:{day}", day, title, reason, cents))

    current_start = monday(today)
    week = _period(days, current_start, today)
    previous = _period(days, current_start - timedelta(days=7), today - timedelta(days=7))
    target = targets.get(current_start, DEFAULT_WEEKLY_MINUTES)
    elapsed_days = today.weekday() + 1
    expected = round(target * elapsed_days / 7)
    task_rows = [row for row in planned_tasks if current_start <= row[0] <= today]
    task_weight = sum(row[1] for row in task_rows)
    execution = round(100 * sum(row[1] * row[2] for row in task_rows) / task_weight) if task_weight else None
    focus_score = min(100, round(100 * week["minutes"] / max(1, expected)))
    consistency = round(100 * week["productiveDays"] / elapsed_days)
    index = round(focus_score * .6 + consistency * .4) if execution is None else round(focus_score * .5 + execution * .3 + consistency * .2)
    total = _period(days, min(days, default=today), today)
    tier = max(i for i, (_, cents, count) in enumerate(STATUS_TIERS) if total["capitalCents"] >= cents and total["productiveDays"] >= count)
    next_tier = STATUS_TIERS[tier + 1] if tier + 1 < len(STATUS_TIERS) else None
    latest = today if days.get(today, {}).get("productive") else today - timedelta(days=1)
    streak = days.get(latest, {}).get("streak", 0)
    history = []
    for offset in range(7, -1, -1):
        start = current_start - timedelta(days=7 * offset)
        history.append({"start": start.isoformat(), "targetMinutes": targets.get(start, DEFAULT_WEEKLY_MINUTES),
                        **_period(days, start, min(today, start + timedelta(days=6)))})
    monthly_history = []
    for offset in range(5, -1, -1):
        month_number = today.year * 12 + today.month - 1 - offset
        start = date(month_number // 12, month_number % 12 + 1, 1)
        next_month = date((month_number + 1) // 12, (month_number + 1) % 12 + 1, 1)
        monthly_history.append({"start": start.isoformat(), **_period(days, start, min(today, next_month - timedelta(days=1)))})
    return {
        "rewardPolicy": {
            "hourlyCents": WORK_CENTS_PER_MINUTE * 60,
            "taskCents": TASK_CENTS["MEDIUM"], "priorityTaskCents": TASK_CENTS["HIGH"],
            "milestoneCents": OBJECTIVE_CENTS["MILESTONE"], "objectiveCents": OBJECTIVE_CENTS["OBJECTIVE"],
            "projectCents": OBJECTIVE_CENTS["PROJECT"], "deadlineBonusCents": DEADLINE_BONUS_CENTS,
            "focusBonusCents": FOCUS_BONUS_CENTS, "streakBonusCents": STREAK_BONUS_CENTS,
        },
        "today": today.isoformat(), "index": index, "execution": execution,
        "focusScore": focus_score, "consistency": consistency, "streak": streak,
        "daily": _period(days, today, today), "week": week, "previousWeek": previous,
        "month": _period(days, today.replace(day=1), today), "total": total,
        "targetMinutes": target, "expectedMinutes": expected,
        "gapMinutes": week["minutes"] - expected,
        "remainingMinutes": max(0, target - week["minutes"]),
        "requiredDailyMinutes": (max(0, target - week["minutes"]) + (7 - today.weekday()) - 1) // (7 - today.weekday()),
        "status": STATUS_TIERS[tier][0],
        "nextStatus": next_tier[0] if next_tier else None,
        "nextCapitalCents": next_tier[1] if next_tier else total["capitalCents"],
        "nextProductiveDays": next_tier[2] if next_tier else total["productiveDays"],
        "statusProgress": min(100, round(100 * min(total["capitalCents"] / next_tier[1], total["productiveDays"] / next_tier[2]))) if next_tier else 100,
        "history": history,
        "monthlyHistory": monthly_history,
        "rewards": sorted(rewards, key=lambda entry: (entry["date"], entry["id"]), reverse=True)[:50],
    }


def _empty_day() -> dict:
    return {"daily_log": 0, "focus": 0, "minutes": 0, "tasks": 0, "objectives": 0, "capitalCents": 0, "productive": False, "streak": 0}


def _period(days: dict[date, dict], start: date, end: date) -> dict:
    selected = [daily for day, daily in days.items() if start <= day <= end]
    return {"minutes": sum(day["minutes"] for day in selected),
            "focusMinutes": sum(day["focus"] for day in selected),
            "tasks": sum(day["tasks"] for day in selected),
            "objectives": sum(day["objectives"] for day in selected),
            "capitalCents": sum(day["capitalCents"] for day in selected),
            "productiveDays": sum(bool(day["productive"]) for day in selected)}


def _reward(key: str, day: date, title: str, reason: str, cents: int) -> dict:
    return {"id": key, "date": day.isoformat(), "title": title, "reason": reason, "capitalCents": cents}
