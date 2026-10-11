from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session

from app.core.config import settings
from app.db.engine import build_engine
from app.models import Comment, FriendLink, Message, Photo, Post, User

engine = build_engine(settings.database_url)


def _ensure_sqlite_owner_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return

    owner_tables = [
        Post.__tablename__,
        FriendLink.__tablename__,
        Message.__tablename__,
        Photo.__tablename__,
        Comment.__tablename__,
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
            if table_name == Comment.__tablename__ and "parent_id" not in columns:
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN parent_id INTEGER"))

        # Migrate username column for existing user tables
        if User.__tablename__ in existing_tables:
            user_columns = {column["name"] for column in inspector.get_columns(User.__tablename__)}
            if "username" not in user_columns:
                connection.execute(text(f"ALTER TABLE {User.__tablename__} ADD COLUMN username VARCHAR DEFAULT ''"))
                # Backfill usernames for existing users
                import re
                rows = connection.execute(text(f"SELECT id, email, nickname FROM {User.__tablename__} WHERE username = '' OR username IS NULL")).fetchall()
                used: set[str] = set()
                for row in rows:
                    base = (row.nickname or "").strip()
                    if not base:
                        base = (row.email or "user").split("@")[0]
                    base = re.sub(r"[^a-z0-9_-]", "", base.lower())[:27] or "user"
                    candidate = base
                    n = 1
                    while candidate in used:
                        n += 1
                        candidate = f"{base}{n}"
                    used.add(candidate)
                    connection.execute(text(f"UPDATE {User.__tablename__} SET username = :un WHERE id = :uid"), {"un": candidate, "uid": row.id})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_sqlite_owner_columns()


def get_session():
    with Session(engine) as session:
        yield session
