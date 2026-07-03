from datetime import datetime, timezone

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class PostBase(SQLModel):
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1)
    category: str = Field(default="未分类", max_length=60)
    cover_url: str = Field(default="")


class Post(PostBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id", index=True)
    summary: str = Field(default="", max_length=280)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    keyword_matches: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PostCreate(PostBase):
    keywords: list[str] = Field(default_factory=list)


class PostUpdate(PostBase):
    keywords: list[str] = Field(default_factory=list)


class PostRead(PostBase):
    id: int
    summary: str
    tags: list[str]
    keyword_matches: list[str]
    created_at: datetime
    updated_at: datetime


class PostList(SQLModel):
    posts: list[PostRead]
    total: int
