from sqlalchemy.engine import Engine, make_url
from sqlalchemy.pool import NullPool
from sqlmodel import create_engine


def build_engine(database_url: str) -> Engine:
    url = make_url(database_url)
    if url.drivername in {"postgres", "postgresql", "postgresql+psycopg"}:
        url = url.set(drivername="postgresql+psycopg")
        if "sslmode" not in url.query:
            url = url.update_query_dict({"sslmode": "require"})
        return create_engine(
            url,
            poolclass=NullPool,
            # Neon transaction pooling does not need application-side pooling.
            connect_args={"prepare_threshold": None, "connect_timeout": 10},
        )
    if url.get_backend_name() == "sqlite":
        return create_engine(url, connect_args={"check_same_thread": False})
    raise ValueError("DATABASE_URL must use SQLite or PostgreSQL")
