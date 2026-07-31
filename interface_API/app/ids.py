"""cuid-like identifier generation, compatible with Prisma's text ids."""

from __future__ import annotations

import secrets
import time

_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"


def _base36(value: int, width: int) -> str:
    out = ""
    while value > 0:
        value, rem = divmod(value, 36)
        out = _ALPHABET[rem] + out
    return out.rjust(width, "0")[-width:]


def new_id() -> str:
    """Generate a collision-resistant id shaped like a cuid (starts with 'c')."""
    timestamp = _base36(int(time.time() * 1000), 8)
    random_block = "".join(secrets.choice(_ALPHABET) for _ in range(16))
    return f"c{timestamp}{random_block}"
