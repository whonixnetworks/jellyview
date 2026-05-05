"""SQLite database engine and session setup with WAL mode."""
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session, declarative_base

from .config import settings

# Ensure data directory exists
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)

# Create engine with SQLite WAL mode enabled
engine = create_engine(
    settings.db_url,
    connect_args={
        "check_same_thread": False,
        "timeout": 30,
    },
    echo=settings.log_level == "DEBUG",
)


# Enable WAL mode on connection
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Enable SQLite WAL mode for better concurrent access."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency that provides a database session.

    Yields:
        Session: SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
