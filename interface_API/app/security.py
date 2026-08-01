"""Session handling compatible with the Next.js app (lib/auth.ts).

Sessions are HMAC-SHA256 signed payloads stored in the ``life_regime_session``
httpOnly cookie. Because the same AUTH_SECRET is used, cookies issued by the
Next.js app remain valid against this API and vice versa.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import time

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import User

COOKIE_NAME = "life_regime_session"
SESSION_DAYS = 30


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(body: str) -> str:
    secret = get_settings().signing_secret.encode("utf-8")
    return _b64url_encode(hmac.new(secret, body.encode("ascii"), hashlib.sha256).digest())


def encode_session(user_id: str) -> tuple[str, int]:
    """Return (token, expiry epoch ms)."""
    exp = int(time.time() * 1000) + SESSION_DAYS * 24 * 60 * 60 * 1000
    body = _b64url_encode(
        json.dumps({"userId": user_id, "exp": exp}, separators=(",", ":")).encode("utf-8")
    )
    return f"{body}.{_sign(body)}", exp


def decode_session(token: str | None) -> str | None:
    """Return the user id when the token is valid, otherwise None."""
    if not token or "." not in token:
        return None
    try:
        body, sig = token.split(".", 1)
        if not body or not sig:
            return None
        expected = _sign(body)
        if not hmac.compare_digest(sig.encode("ascii"), expected.encode("ascii")):
            return None
        payload = json.loads(_b64url_decode(body))
    except (ValueError, UnicodeError, binascii.Error):
        return None

    if not isinstance(payload, dict):
        return None
    user_id = payload.get("userId")
    exp = payload.get("exp")
    if not isinstance(user_id, str) or not user_id:
        return None
    if isinstance(exp, bool) or not isinstance(exp, (int, float)):
        return None
    if exp < int(time.time() * 1000):
        return None
    return user_id


def set_session_cookie(response: Response, user_id: str) -> None:
    token, exp = encode_session(user_id)
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        secure=get_settings().is_production,
        path="/",
        max_age=SESSION_DAYS * 24 * 60 * 60,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def ensure_local_user(db: Session) -> User:
    user = db.execute(select(User).order_by(User.createdAt.asc()).limit(1)).scalar_one_or_none()
    if user:
        return user
    user = User(label="Local user")
    db.add(user)
    db.flush()
    return user


def authenticate_access_key(db: Session, candidate: str) -> User | None:
    expected = get_settings().access_key
    if not hmac.compare_digest(candidate.encode("utf-8"), expected.encode("utf-8")):
        return None
    return ensure_local_user(db)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = decode_session(request.cookies.get(COOKIE_NAME))
    if user_id:
        user = db.get(User, user_id)
        if user:
            return user
    raise HTTPException(status_code=401, detail="Unauthorized")
