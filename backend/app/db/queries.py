from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Session

from app.models.post import Post


def post_tag_filter(session: Session, tag: str):
    # Read array elements rather than searching serialized JSON (which can escape Chinese text).
    if session.get_bind().dialect.name == "postgresql":
        value = func.jsonb_array_elements_text(Post.tags.cast(JSONB)).column_valued("tag_value")
    else:
        value = func.json_each(Post.tags).table_valued("value").c.value
    return select(1).where(value.ilike(f"%{tag.strip()}%")).correlate(Post).exists()
