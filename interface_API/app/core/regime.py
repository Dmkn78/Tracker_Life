"""Regime detection, ported from lib/regime.ts.

Logs are passed as dicts with the DailyLog field names (camelCase keys).
"""

from __future__ import annotations

REGIMES = ("stable", "productive", "pressure", "recovery", "drift", "burnout_risk", "chaotic")


def _clamp(value: float, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, round(value)))


def _status(log: dict | None) -> str:
    return ((log or {}).get("status") or "").upper()


def _normalize_regime(value: str | None) -> str | None:
    return value if value in REGIMES else None


def risk_level(risk_score: int | None) -> str:
    risk = risk_score or 0
    if risk >= 75:
        return "critical"
    if risk >= 60:
        return "high"
    if risk >= 40:
        return "medium"
    return "low"


def compute_regime(
    current_log: dict | None,
    previous_submitted_log: dict | None,
    recent_submitted_logs: list[dict],
    calendar: dict,
    todo_metrics: dict,
    missing_days_this_week: int,
) -> dict:
    log = current_log or {}
    previous = previous_submitted_log
    submitted = [item for item in recent_submitted_logs if _status(item) == "SUBMITTED"]
    data_incomplete = (
        current_log is None or _status(log) != "SUBMITTED" or missing_days_this_week > 1
    )
    high_risk_streak = (
        len([item for item in submitted[-3:] if (item.get("riskScore") or 0) > 75]) >= 2
    )
    execution_falling = (
        previous is not None
        and previous.get("executionScore") is not None
        and log.get("executionScore") is not None
        and log["executionScore"] < previous["executionScore"] - 8
    )
    state_stable = (
        previous is not None
        and previous.get("stateScore") is not None
        and log.get("stateScore") is not None
        and abs(log["stateScore"] - previous["stateScore"]) <= 6
    )
    pressure_signal = (
        calendar["highImpactEventsNext7d"] > 0
        or calendar["averageStress"] >= 68
        or calendar["weeklyExpectedStressLoad"] >= 70
        or calendar["maxImpact"] in ("HIGH", "CRITICAL")
    )
    risk_decreasing = (log.get("riskDelta") or 0) < -4 or (
        previous is not None
        and previous.get("riskScore") is not None
        and log.get("riskScore") is not None
        and log["riskScore"] < previous["riskScore"] - 4
    )
    last_regime = _normalize_regime((previous or {}).get("regime"))

    regime = "stable"
    confidence = 58
    why: list[str] = []

    if (log.get("riskScore") or 0) > 75 and high_risk_streak:
        regime = "burnout_risk"
        confidence = 88
        why.append("Risk score is above 75 across multiple submitted logs.")
    elif (log.get("energy") if log.get("energy") is not None else 100) < 35 and (
        log.get("startFriction") or 0
    ) > 70:
        regime = "burnout_risk"
        confidence = 84
        why.append("Energy is below 35 while start friction is above 70.")
    elif (log.get("riskAcceleration") or 0) >= 14 and data_incomplete:
        regime = "chaotic"
        confidence = 78
        why.append("Risk acceleration is high and data quality is incomplete.")
    elif pressure_signal:
        regime = "pressure"
        confidence = 72 + min(18, calendar["highImpactEventsNext7d"] * 5)
        why.append("Calendar pressure is elevated by upcoming high-impact context.")
    elif (log.get("executionScore") or 0) > 70 and (
        log.get("riskScore") if log.get("riskScore") is not None else 100
    ) < 50:
        regime = "productive"
        confidence = 76
        why.append("Execution is above 70 while risk remains below 50.")
    elif log.get("trainingDone") is True and risk_decreasing:
        regime = "recovery"
        confidence = 70
        why.append("Training is done and risk is decreasing.")
    elif (
        missing_days_this_week > 0
        or execution_falling
        or todo_metrics["weightedCompletionRate"] < 0.35
    ):
        regime = "drift"
        confidence = 66 + min(16, missing_days_this_week * 4)
        if missing_days_this_week > 0:
            why.append("Daily log coverage is incomplete this week.")
        if execution_falling:
            why.append("Execution score is decreasing versus the previous submitted log.")
        if todo_metrics["weightedCompletionRate"] < 0.35:
            why.append("Task completion is below 35%.")
    elif state_stable and risk_level(log.get("riskScore")) not in ("high", "critical"):
        regime = "stable"
        confidence = 72
        why.append("State is stable and risk is moderate or low.")

    if not why:
        why.append("No strong pressure, drift, recovery, or burnout signal dominates today.")

    return {
        "regime": regime,
        "confidence": _clamp(confidence),
        "why": why,
        "lastRegime": last_regime,
        "changed": last_regime is not None and last_regime != regime,
    }


def compute_regime_transition(current: str, target: str, calendar: dict) -> float:
    if current == target:
        return 0.48
    if target == "pressure" and calendar["highImpactEventsNext7d"] > 0:
        return 0.24
    if target == "burnout_risk" and calendar["averageStress"] > 75:
        return 0.14
    if target == "drift":
        return 0.14
    if target == "recovery":
        return 0.1
    return 0.06


def simulate_next_week(regime: dict, calendar: dict) -> list[dict]:
    raw = [
        {"regime": target, "probability": compute_regime_transition(regime["regime"], target, calendar)}
        for target in REGIMES
    ]
    total = sum(item["probability"] for item in raw) or 1
    projected = [
        {"regime": item["regime"], "probability": _clamp(item["probability"] / total * 100)}
        for item in raw
    ]
    return sorted(projected, key=lambda item: item["probability"], reverse=True)


def build_transition_matrix_placeholder(regime: dict, calendar: dict) -> list[dict]:
    matrix = []
    for source in REGIMES:
        row = [compute_regime_transition(source, target, calendar) for target in REGIMES]
        total = sum(row) or 1
        matrix.append(
            {
                "from": source,
                "active": source == regime["regime"],
                "probabilities": {
                    target: _clamp(row[index] / total * 100) for index, target in enumerate(REGIMES)
                },
            }
        )
    return matrix
