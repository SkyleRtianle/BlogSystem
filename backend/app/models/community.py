from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class FriendLinkBase(SQLModel):
    name: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=180)


class FriendLink(FriendLinkBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FriendLinkCreate(FriendLinkBase):
    pass


class FriendLinkRead(FriendLinkBase):
    id: int
    created_at: datetime


class FriendLinkList(SQLModel):
    links: list[FriendLinkRead]
    total: int


class MessageBase(SQLModel):
    author: str = Field(min_length=1, max_length=60)
    content: str = Field(min_length=1, max_length=500)


class Message(MessageBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MessageCreate(MessageBase):
    pass


class MessageRead(MessageBase):
    id: int
    created_at: datetime


class MessageList(SQLModel):
    messages: list[MessageRead]
    total: int


class PhotoBase(SQLModel):
    title: str = Field(min_length=1, max_length=100)
    image_url: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=240)


class Photo(PhotoBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PhotoCreate(PhotoBase):
    pass


class PhotoRead(PhotoBase):
    id: int
    created_at: datetime


class PhotoList(SQLModel):
    photos: list[PhotoRead]
    total: int
