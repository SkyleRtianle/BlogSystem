from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class UserBase(SQLModel):
    email: str = Field(min_length=3, max_length=160)
    nickname: str = Field(default="", max_length=80)


class User(UserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(min_length=3, max_length=160, unique=True, index=True)
    password_hash: str
    session_token: str = Field(default="", unique=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=120)


class UserLogin(SQLModel):
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=120)


class UserRead(UserBase):
    id: int
    created_at: datetime


class AuthResponse(SQLModel):
    token: str
    user: UserRead
