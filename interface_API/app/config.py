"""Application settings loaded from environment variables / .env file."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/life_regime_tracker"
DEFAULT_FRONTEND_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
DEFAULT_WHISPER_SERVICE_URL = "http://127.0.0.1:8001/transcribe"
DEVELOPMENT_ACCESS_KEY = "dev-access-key"
DEVELOPMENT_SIGNING_SECRET = "dev-only-life-regime-secret"

load_dotenv(BASE_DIR / ".env")
# Fall back to the repository root .env (shared with the Next.js app) for
# DATABASE_URL / APP_ACCESS_KEY / AUTH_SECRET during the transition period.
load_dotenv(BASE_DIR.parent / ".env")


def _sqlalchemy_url(raw: str) -> str:
    """Convert a Prisma-style PostgreSQL URL into a SQLAlchemy one.

    Prisma URLs may carry a ``schema`` query parameter that psycopg2 does not
    understand, and use the plain ``postgresql://`` scheme.
    """
    parts = urlsplit(raw)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k.lower() != "schema"]
    scheme = "postgresql+psycopg2" if parts.scheme in ("postgres", "postgresql") else parts.scheme
    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _read_positive_integer(name: str, default: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    try:
        parsed_value = int(raw_value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer") from error
    if parsed_value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return parsed_value


@dataclass(frozen=True)
class Settings:
    database_url: str
    app_access_key: str
    auth_secret: str
    whisper_service_url: str
    frontend_origins: tuple[str, ...]
    api_host: str
    api_port: int
    max_audio_bytes: int
    whisper_timeout_seconds: int
    is_production: bool

    @property
    def signing_secret(self) -> str:
        return self.auth_secret or self.app_access_key or DEVELOPMENT_SIGNING_SECRET

    @property
    def access_key(self) -> str:
        return self.app_access_key or DEVELOPMENT_ACCESS_KEY

    @property
    def is_using_dev_access_key(self) -> bool:
        return not self.app_access_key

    @property
    def cookie_secure(self) -> bool:
        """Defaults to `is_production`. Set COOKIE_SECURE=false when serving
        production over plain HTTP (no domain/TLS yet) so the session cookie
        set here matches the one Next.js issues (lib/auth.ts)."""
        override = os.environ.get("COOKIE_SECURE", "").lower()
        if override == "false":
            return False
        if override == "true":
            return True
        return self.is_production


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    is_production = os.environ.get("ENV", "development").lower() == "production"
    app_access_key = os.environ.get("APP_ACCESS_KEY", "")
    auth_secret = os.environ.get("AUTH_SECRET", "")
    if is_production and (not app_access_key or not auth_secret):
        raise RuntimeError("APP_ACCESS_KEY and AUTH_SECRET are required in production")

    frontend_origins = tuple(
        origin.strip()
        for origin in os.environ.get("FRONTEND_ORIGINS", DEFAULT_FRONTEND_ORIGINS).split(",")
        if origin.strip()
    )
    return Settings(
        database_url=_sqlalchemy_url(os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)),
        app_access_key=app_access_key,
        auth_secret=auth_secret,
        whisper_service_url=os.environ.get("WHISPER_SERVICE_URL", DEFAULT_WHISPER_SERVICE_URL),
        frontend_origins=frontend_origins,
        api_host=os.environ.get("API_HOST", "127.0.0.1"),
        api_port=_read_positive_integer("API_PORT", 8000),
        max_audio_bytes=_read_positive_integer("MAX_AUDIO_BYTES", 25 * 1024 * 1024),
        whisper_timeout_seconds=_read_positive_integer("WHISPER_TIMEOUT_SECONDS", 180),
        is_production=is_production,
    )
