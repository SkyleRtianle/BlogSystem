"""Copy an existing SQLite blog to an EMPTY Neon database and R2 bucket.

Run from backend/: uv run python scripts/migrate_to_neon_r2.py
This only inspects the source unless --apply is explicitly passed.
"""

import argparse
import base64
import hashlib
import mimetypes
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlmodel import SQLModel

from app.core.config import BACKEND_DIR, settings
from app.db.engine import build_engine
from app.models import Photo  # Imports all model tables.
from app.services.photo_storage import IMAGE_TYPES, R2PhotoStorage, safe_filename


def photo_object(row: dict, directory: Path) -> tuple[str, bytes, str]:
    value = row["image_url"]
    if value.startswith("data:"):
        header, encoded = value.split(",", 1)
        content_type = header.removeprefix("data:").split(";", 1)[0]
        if not header.endswith(";base64") or content_type not in IMAGE_TYPES:
            raise ValueError(f"Photo {row['id']} has an unsupported data URL")
        content = base64.b64decode(encoded, validate=True)
        identifier = uuid.uuid5(uuid.NAMESPACE_URL, f"blogsystem-photo:{row['id']}:{hashlib.sha256(content).hexdigest()}")
        filename = f"{row['owner_id'] or 0}_{identifier.hex}{IMAGE_TYPES[content_type]}"
    else:
        filename = safe_filename(value)
        content = (directory / filename).read_bytes()
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return filename, content, content_type


def read_source(path: Path) -> dict[str, list[dict]]:
    if not path.is_file():
        raise ValueError("SQLite source file does not exist")
    engine = build_engine(f"sqlite:///{path}")
    try:
        with engine.connect() as connection:
            connection.execute(text("PRAGMA query_only = ON"))
            return {
                table.name: [dict(row) for row in connection.execute(select(table)).mappings()]
                for table in SQLModel.metadata.sorted_tables
            }
    finally:
        engine.dispose()


def migrate(rows: dict[str, list[dict]], target, storage: R2PhotoStorage, photos_dir: Path) -> None:
    if target.dialect.name != "postgresql":
        raise ValueError("Migration target must be Neon PostgreSQL")
    # Validate every local photo before touching the destination.
    for row in rows[Photo.__tablename__]:
        photo_object(row, photos_dir)
    SQLModel.metadata.create_all(target)
    created_objects = []
    try:
        with target.begin() as connection:
            # Exclude concurrent writers while checking and filling the target tables.
            names = ", ".join(target.dialect.identifier_preparer.quote(table.name) for table in SQLModel.metadata.sorted_tables)
            connection.execute(text(f"LOCK TABLE {names} IN ACCESS EXCLUSIVE MODE"))
            for table in SQLModel.metadata.sorted_tables:
                if connection.scalar(select(func.count()).select_from(table)):
                    raise ValueError("Target database contains data; use a new empty Neon branch")

            for row in rows[Photo.__tablename__]:
                filename, content, content_type = photo_object(row, photos_dir)
                try:
                    storage._call("head_object", Key=filename)
                except HTTPException as error:
                    if error.status_code != 404:
                        raise
                    storage.put(filename, content, content_type)
                    created_objects.append(filename)
                else:
                    raise ValueError("An R2 destination object already exists; use a new empty bucket")
                row["image_url"] = filename

            for table in SQLModel.metadata.sorted_tables:
                data = rows[table.name]
                if not data:
                    continue
                connection.execute(table.insert(), data)
                quoted = target.dialect.identifier_preparer.quote(table.name)
                # Explicit imported IDs must not collide with the next inserted row.
                connection.execute(
                    text(f"SELECT setval(pg_get_serial_sequence(:relation, 'id'), (SELECT MAX(id) FROM {quoted}), true)"),
                    {"relation": quoted},
                )
    except Exception:
        for filename in created_objects:
            try:
                storage.delete(filename)
            except Exception:
                print("An uploaded object could not be cleaned up; inspect the migration bucket.", file=sys.stderr)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, default=BACKEND_DIR / "blogsystem.db")
    parser.add_argument("--photos-dir", type=Path, default=BACKEND_DIR / "uploads" / "photos")
    parser.add_argument("--apply", action="store_true", help="Write to the configured empty Neon database and R2 bucket")
    args = parser.parse_args()
    rows = read_source(args.sqlite.resolve())
    for table, data in rows.items():
        print(f"{table}: {len(data)} rows")
    for row in rows[Photo.__tablename__]:
        photo_object(row, args.photos_dir.resolve())
    if not args.apply:
        print("Dry run complete. No database rows or objects were changed. Use --apply after configuring Neon/R2.")
        return
    settings.validate_runtime()
    if settings.photo_storage != "r2":
        raise ValueError("Set PHOTO_STORAGE=r2 before applying the migration")
    target = build_engine(settings.database_url)
    try:
        migrate(rows, target, R2PhotoStorage(settings), args.photos_dir.resolve())
    finally:
        target.dispose()
    print("Migration complete. Source SQLite database and local photos were left unchanged.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Database exceptions can contain credentials or private row content.
        print("Migration failed. Check source schema/files, target emptiness, and Neon/R2 configuration. No source data was modified.", file=sys.stderr)
        sys.exit(1)
