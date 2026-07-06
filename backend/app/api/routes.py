import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session, col, func, or_, select

from app.core.config import settings
from app.db.session import get_session
from app.models.community import (
    FriendLink,
    FriendLinkCreate,
    FriendLinkList,
    FriendLinkRead,
    Message,
    MessageCreate,
    MessageList,
    MessageRead,
    Photo,
    PhotoList,
    PhotoRead,
)
from app.models.post import Post, PostCreate, PostList, PostRead, PostUpdate
from app.models.user import AuthResponse, User, UserCreate, UserLogin, UserRead
from app.services.post_processing import build_summary, find_keyword_matches, generate_tags

router = APIRouter()
PASSWORD_ITERATIONS = 210_000
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "photos")


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt}${digest}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = password_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations),
    ).hex()
    return hmac.compare_digest(digest, expected)


def _new_session_token() -> str:
    return secrets.token_urlsafe(32)


def get_current_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = authorization.removeprefix("Bearer ").strip()
    user = session.exec(select(User).where(User.session_token == token)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return user


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/site")
async def site_info() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "env": settings.app_env,
    }


@router.post("/auth/register", response_model=AuthResponse, status_code=201)
async def register(payload: UserCreate, session: Session = Depends(get_session)) -> AuthResponse:
    email = _normalize_email(payload.email)
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    username = payload.username.strip() if payload.username else ""
    if not username:
        import re
        username = re.sub(r"[^a-z0-9_-]", "", email.split("@", 1)[0].lower())[:27] or "user"
    else:
        import re
        username = re.sub(r"[^a-z0-9_-]", "", username.lower())[:30]
        if not username or len(username) < 3:
            username = re.sub(r"[^a-z0-9_-]", "", email.split("@", 1)[0].lower())[:27] or "user"

    # Resolve username collision
    base = username
    n = 1
    while session.exec(select(User).where(User.username == username)).first() is not None:
        n += 1
        username = f"{base}{n}" if len(f"{base}{n}") <= 30 else f"{base[:30-len(str(n))]}{n}"

    user = User(
        email=email,
        username=username,
        nickname=payload.nickname.strip() or email.split("@", 1)[0],
        password_hash=_hash_password(payload.password),
        session_token=_new_session_token(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return AuthResponse(token=user.session_token, user=UserRead.model_validate(user))


@router.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin, session: Session = Depends(get_session)) -> AuthResponse:
    email = _normalize_email(payload.email)
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.session_token = _new_session_token()
    session.add(user)
    session.commit()
    session.refresh(user)
    return AuthResponse(token=user.session_token, user=UserRead.model_validate(user))


@router.get("/auth/me", response_model=UserRead)
async def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/posts", response_model=PostRead, status_code=201)
async def create_post(
    payload: PostCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Post:
    plain_search_text = f"{payload.title}\n{payload.content}"
    keyword_matches = find_keyword_matches(plain_search_text, payload.keywords)
    post = Post(
        owner_id=current_user.id,
        title=payload.title.strip(),
        content=payload.content.strip(),
        category=payload.category.strip() or "未分类",
        cover_url=payload.cover_url.strip(),
        summary=build_summary(payload.content),
        tags=generate_tags(payload.title, payload.content, keyword_matches),
        keyword_matches=keyword_matches,
    )

    session.add(post)
    session.commit()
    session.refresh(post)
    return post


@router.put("/posts/{post_id}", response_model=PostRead)
async def update_post(
    post_id: int,
    payload: PostUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Post:
    post = session.exec(select(Post).where(Post.id == post_id, Post.owner_id == current_user.id)).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    plain_search_text = f"{payload.title}\n{payload.content}"
    keyword_matches = find_keyword_matches(plain_search_text, payload.keywords)
    post.title = payload.title.strip()
    post.content = payload.content.strip()
    post.category = payload.category.strip() or "未分类"
    post.cover_url = payload.cover_url.strip()
    post.summary = build_summary(payload.content)
    post.tags = generate_tags(payload.title, payload.content, keyword_matches)
    post.keyword_matches = keyword_matches
    post.updated_at = datetime.now(timezone.utc)

    session.add(post)
    session.commit()
    session.refresh(post)
    return post


@router.get("/posts", response_model=PostList)
async def list_posts(
    keyword: str | None = Query(default=None, max_length=80),
    tag: str | None = Query(default=None, max_length=40),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PostList:
    statement = select(Post).where(Post.owner_id == current_user.id).order_by(col(Post.created_at).desc())
    count_statement = select(func.count(Post.id)).where(Post.owner_id == current_user.id)

    filters = []
    if keyword:
        pattern = f"%{keyword.strip()}%"
        filters.append(
            or_(
                col(Post.title).like(pattern),
                col(Post.content).like(pattern),
                col(Post.summary).like(pattern),
            )
        )

    if tag:
        filters.append(col(Post.tags).like(f"%{tag.strip()}%"))

    for item in filters:
        statement = statement.where(item)
        count_statement = count_statement.where(item)

    posts = session.exec(statement).all()
    total = session.exec(count_statement).one()
    return PostList(posts=posts, total=total)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    post = session.exec(select(Post).where(Post.id == post_id, Post.owner_id == current_user.id)).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    session.delete(post)
    session.commit()


@router.get("/posts/{post_id}", response_model=PostRead)
async def get_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Post:
    post = session.exec(select(Post).where(Post.id == post_id, Post.owner_id == current_user.id)).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/links", response_model=FriendLinkRead, status_code=201)
async def create_friend_link(
    payload: FriendLinkCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FriendLink:
    link = FriendLink(
        owner_id=current_user.id,
        name=payload.name.strip(),
        url=payload.url.strip(),
        description=payload.description.strip(),
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.get("/links", response_model=FriendLinkList)
async def list_friend_links(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FriendLinkList:
    statement = select(FriendLink).where(FriendLink.owner_id == current_user.id).order_by(col(FriendLink.created_at).desc())
    links = session.exec(statement).all()
    total = session.exec(select(func.count(FriendLink.id)).where(FriendLink.owner_id == current_user.id)).one()
    return FriendLinkList(links=links, total=total)


@router.post("/messages", response_model=MessageRead, status_code=201)
async def create_message(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Message:
    message = Message(owner_id=current_user.id, author=payload.author.strip(), content=payload.content.strip())
    session.add(message)
    session.commit()
    session.refresh(message)
    return message


@router.get("/messages", response_model=MessageList)
async def list_messages(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MessageList:
    statement = select(Message).where(Message.owner_id == current_user.id).order_by(col(Message.created_at).desc())
    messages = session.exec(statement).all()
    total = session.exec(select(func.count(Message.id)).where(Message.owner_id == current_user.id)).one()
    return MessageList(messages=messages, total=total)


@router.post("/photos", response_model=PhotoRead, status_code=201)
async def create_photo(
    title: str = Form(min_length=1, max_length=100),
    description: str = Form(default="", max_length=240),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Photo:
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as fh:
        fh.write(content)

    photo = Photo(
        owner_id=current_user.id,
        title=title.strip(),
        image_url=filename,
        description=description.strip(),
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


@router.get("/photos", response_model=PhotoList)
async def list_photos(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PhotoList:
    statement = select(Photo).where(Photo.owner_id == current_user.id).order_by(col(Photo.created_at).desc())
    photos = session.exec(statement).all()
    total = session.exec(select(func.count(Photo.id)).where(Photo.owner_id == current_user.id)).one()
    return PhotoList(photos=photos, total=total)


@router.get("/photos/file/{filename}")
async def get_photo_file(filename: str) -> FileResponse:
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)


@router.delete("/photos/{photo_id}", status_code=204)
async def delete_photo(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    photo = session.exec(select(Photo).where(Photo.id == photo_id, Photo.owner_id == current_user.id)).first()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not photo.image_url.startswith("data:"):
        filepath = os.path.join(UPLOAD_DIR, photo.image_url)
        if os.path.isfile(filepath):
            os.remove(filepath)

    session.delete(photo)
    session.commit()
