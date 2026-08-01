"""Numeric compatibility helpers for logic ported from JavaScript."""

from __future__ import annotations

import math


def javascript_round(value: float) -> int:
    """Match JavaScript ``Math.round`` for finite numeric domain values."""
    if not math.isfinite(value):
        raise ValueError("Cannot round a non-finite value")
    return math.floor(value + 0.5)
