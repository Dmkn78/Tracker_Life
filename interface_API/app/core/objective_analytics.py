"""Deterministic planning calculations. Missing observations stay missing."""

from dataclasses import dataclass
from datetime import date, timedelta
from math import ceil
from random import Random

SIMULATION_RUNS = 400
MIN_HISTORY_DAYS = 7


@dataclass(frozen=True)
class Checkpoint:
    day: date
    progress: int


def expected_progress(start: date, deadline: date | None, today: date) -> float | None:
    if deadline is None:
        return None
    duration = (deadline - start).days
    if duration <= 0:
        return 100.0 if today >= deadline else 0.0
    return round(max(0, min(100, 100 * (today - start).days / duration)), 1)


def trajectory(progress: int, history: list[Checkpoint], deadline: date | None, today: date) -> dict:
    observations = {point.day: point.progress for point in history if point.day <= today}
    observations[today] = progress
    points = sorted(observations.items())
    baseline = next(((day, value) for day, value in reversed(points) if today - timedelta(days=28) <= day <= today - timedelta(days=7)), None)
    previous = next(((day, value) for day, value in reversed(points) if today - timedelta(days=28) <= day <= today - timedelta(days=14)), None)
    # Use the actual interval when no observation exists precisely seven days ago.
    velocity = (progress - baseline[1]) * 7 / (today - baseline[0]).days if baseline else None
    previous_velocity = (baseline[1] - previous[1]) * 7 / (baseline[0] - previous[0]).days if baseline and previous and baseline[0] > previous[0] else None
    last_incomplete = max((day for day, value in points if value < 100), default=date.min)
    completed_date = next((day for day, value in points if value >= 100 and day > last_incomplete), today)
    forecast = completed_date if progress >= 100 else None
    if velocity is not None and velocity > 0 and progress < 100:
        days_remaining = ceil((100 - progress) * 7 / velocity)
        if days_remaining <= 3650:
            forecast = today + timedelta(days=days_remaining)
    remaining_days = max(0, (deadline - today).days) if deadline else None
    required = (100 - progress) * 7 / remaining_days if remaining_days and progress < 100 else None
    return {
        "velocity": round(velocity, 1) if velocity is not None else None,
        "momentum": round(velocity - previous_velocity, 1) if velocity is not None and previous_velocity is not None else None,
        "requiredVelocity": round(required, 1) if required is not None else None,
        "forecastDate": forecast.isoformat() if forecast else None,
        "slipDays": (forecast - deadline).days if forecast and deadline else None,
        "onTimeProbability": (100 if completed_date <= deadline else 0) if progress >= 100 and deadline else simulate_on_time(progress, points, deadline, today),
        "observationCount": len(history),
    }


def simulate_on_time(progress: int, points: list[tuple[date, int]], deadline: date | None, today: date) -> int | None:
    if deadline is None:
        return None
    if progress >= 100:
        return 100
    if deadline <= today:
        return 0
    # Only consecutive, explicitly observed days are eligible for daily bootstrapping.
    changes = [right[1] - left[1] for left, right in zip(points, points[1:]) if (right[0] - left[0]).days == 1 and right[0] >= today - timedelta(days=28)]
    horizon = (deadline - today).days
    if len(changes) < MIN_HISTORY_DAYS or horizon > 365:
        return None
    random = Random(f"{today}:{progress}:{changes}:{deadline}")
    successes = 0
    for _ in range(SIMULATION_RUNS):
        simulated = progress
        for _ in range(horizon):
            simulated = max(0, simulated + random.choice(changes))
            if simulated >= 100:
                successes += 1
                break
    return round(100 * successes / SIMULATION_RUNS)


@dataclass(frozen=True)
class NetworkTask:
    id: str
    title: str
    progress: int
    optimistic: int
    likely: int
    pessimistic: int
    predecessors: tuple[str, ...]


def critical_path(tasks: list[NetworkTask]) -> dict:
    by_id = {task.id: task for task in tasks}
    pending = set(by_id)
    ordered: list[str] = []
    while pending:
        ready = sorted(task_id for task_id in pending if not (set(by_id[task_id].predecessors) & pending))
        if not ready:
            raise ValueError("Task dependencies cannot contain a cycle")
        ordered.extend(ready)
        pending.difference_update(ready)
    durations = {task.id: (task.optimistic + 4 * task.likely + task.pessimistic) / 6 * (1 - task.progress / 100) for task in tasks}
    starts: dict[str, float] = {}
    finishes: dict[str, float] = {}
    for task_id in ordered:
        starts[task_id] = max((finishes[parent] for parent in by_id[task_id].predecessors if parent in finishes), default=0)
        finishes[task_id] = starts[task_id] + durations[task_id]
    total = max(finishes.values(), default=0)
    latest: dict[str, float] = {}
    successors: dict[str, list[str]] = {}
    for task in tasks:
        for parent in task.predecessors:
            successors.setdefault(parent, []).append(task.id)
    for task_id in reversed(ordered):
        latest[task_id] = min((latest[child] for child in successors.get(task_id, [])), default=total) - durations[task_id]
    missing = sum(task.likely <= 0 and task.progress < 100 for task in tasks)
    return {
        "totalMinutes": round(total), "missingEstimates": missing,
        "tasks": [{"id": task_id, "title": by_id[task_id].title, "predecessorIds": list(by_id[task_id].predecessors),
                   "expectedMinutes": round(durations[task_id]), "startMinutes": round(starts[task_id]),
                   "slackMinutes": round(max(0, latest[task_id] - starts[task_id])),
                   "critical": missing == 0 and durations[task_id] > 0 and abs(latest[task_id] - starts[task_id]) < 0.01}
                  for task_id in ordered],
    }
