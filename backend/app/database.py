"""Database engine / session management.

The project targets PostgreSQL. Because a hackathon demo must run with zero
infrastructure, the engine automatically degrades to a local SQLite file when
the configured PostgreSQL server cannot be reached.
"""

from __future__ import annotations

import logging
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATA_DIR, settings

logger = logging.getLogger("logisense.database")


class Base(DeclarativeBase):
    pass


def _build_engine(url: str) -> Engine:
    kwargs: dict = {"pool_pre_ping": True, "future": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)


def _resolve_engine() -> Engine:
    """Return a working engine, falling back to SQLite when necessary."""
    primary_url = settings.database_url
    if primary_url.startswith("sqlite"):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        return _build_engine(primary_url)

    try:
        engine = _build_engine(primary_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Connected to PostgreSQL database")
        return engine
    except (OperationalError, Exception) as exc:  # noqa: B014 - broad on purpose
        if not settings.sqlite_fallback:
            raise
        logger.warning(
            "PostgreSQL unavailable (%s). Falling back to SQLite at %s",
            type(exc).__name__,
            settings.sqlite_path,
        )
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        return _build_engine(f"sqlite:///{Path(settings.sqlite_path)}")


engine = _resolve_engine()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Safe to call repeatedly."""
    from app import models  # noqa: F401  (ensure metadata is populated)

    Base.metadata.create_all(bind=engine)


def db_healthcheck() -> dict[str, str]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "dialect": engine.dialect.name}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "dialect": engine.dialect.name, "detail": str(exc)}
