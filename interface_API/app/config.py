"""Application settings loaded from environment variables / .env file."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
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


class Settings:
    def __init__(self) -> None:
        raw_db = os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/life_regime_tracker",
        )
        self.database_url = _sqlalchemy_url(raw_db)
        self.app_access_key = os.environ.get("APP_ACCESS_KEY", "")
        self.auth_secret = os.environ.get("AUTH_SECRET", "")
        self.whisper_service_url = os.environ.get(
            "WHISPER_SERVICE_URL", "http://127.0.0.1:8001/transcribe"
        )
        self.frontend_origins = [
            origin.strip()
            for origin in os.environ.get(
                "FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
            ).split(",")
            if origin.strip()
        ]
        self.api_host = os.environ.get("API_HOST", "127.0.0.1")
        self.api_port = int(os.environ.get("API_PORT", "8000"))
        self.is_production = os.environ.get("ENV", "development") == "production"

    @property
    def signing_secret(self) -> str:
        return self.auth_secret or self.app_access_key or "dev-only-life-regime-secret"

    @property
    def access_key(self) -> str:
        return self.app_access_key or "dev-access-key"

    @property
    def is_using_dev_access_key(self) -> bool:
        return not self.app_access_key


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
