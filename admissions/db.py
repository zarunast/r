from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


class Database:
    def __init__(self, url: str):
        if not url.startswith("sqlite:///"):
            raise ValueError("Поддерживается SQLite URL sqlite:///...")
        path = url.removeprefix("sqlite:///")
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        options = {"connect_args": {"check_same_thread": False, "timeout": 30}}
        if path == ":memory:":
            from sqlalchemy.pool import StaticPool
            options["poolclass"] = StaticPool
        self.engine = create_engine(url, **options)

        @event.listens_for(self.engine, "connect")
        def configure(connection, _):
            # SQLite lower() по умолчанию не знает кириллицу.
            connection.create_function("lower", 1, lambda value: value.lower() if isinstance(value, str) else value,
                                       deterministic=True)
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA busy_timeout=30000")

        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    def create_schema(self):
        from . import models  # noqa: F401
        Base.metadata.create_all(self.engine)

    @contextmanager
    def uow(self):
        """Один запрос/импорт — одна транзакция с откатом при исключении."""
        with self.sessions.begin() as session:
            yield session
