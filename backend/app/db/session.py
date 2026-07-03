from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings
from app.models import FriendLink, Message, Photo, Post, User

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)


def _ensure_sqlite_owner_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return

    owner_tables = [
        Post.__tablename__,
        FriendLink.__tablename__,
        Message.__tablename__,
        Photo.__tablename__,
    ]

    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = set(inspector.get_table_names())
        for table_name in owner_tables:
            if table_name not in existing_tables:
                continue

            columns = {column["name"] for column in inspector.get_columns(table_name)}
            if "owner_id" not in columns:
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN owner_id INTEGER"))
            if table_name == Post.__tablename__ and "cover_url" not in columns:
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN cover_url VARCHAR DEFAULT ''"))


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_sqlite_owner_columns()


def get_session():
    with Session(engine) as session:
        yield session
