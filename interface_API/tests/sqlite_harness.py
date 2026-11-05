"""In-memory SQLite database for API tests that only need a few Prisma tables."""

from __future__ import annotations

import json
import sqlite3

from sqlalchemy import JSON, MetaData, create_engine
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


def create_sqlite_session(*models: type) -> Session:
    """PostgreSQL ARRAY/JSONB columns are mapped to JSON so the same models run on SQLite.

    ORM inserts still bind Python lists for ARRAY columns, so lists are stored as JSON text.
    """
    sqlite3.register_adapter(list, json.dumps)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    metadata = MetaData()
    for model in models:
        table = model.__table__.to_metadata(metadata)
        for column in table.columns:
            if isinstance(column.type, (ARRAY, JSONB)):
                column.type = JSON()
    metadata.create_all(engine)
    session = Session(engine, expire_on_commit=False)
    return session
