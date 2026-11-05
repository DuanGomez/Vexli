"""Conexión a la base de datos: PostgreSQL en la nube (DATABASE_URL) o SQLite en el PC."""

import os
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

TZ = ZoneInfo("America/Bogota")


def now() -> datetime:
    """Hora local de Colombia, sin zona (así se guarda en la base)."""
    return datetime.now(TZ).replace(tzinfo=None, microsecond=0)


def _url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./vexli.db")
    # Neon y Render entregan «postgres://» o «postgresql://»: se usa el driver psycopg 3
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


URL = _url()
engine = create_engine(
    URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
