import hashlib
import hmac
import re
import secrets
from contextlib import suppress
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool
from sqlmodel import Session, col, func, or_, select

from app.core.config import settings
from app.db.session import get_session
from app.db.queries import post_tag_filter
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
    PhotoUploadComplete,
    PhotoUploadRequest,
)
from app.models.post import Post, PostCreate, PostList, PostRead, PostUpdate
from app.models.user import AuthResponse, User, UserCreate, UserLogin, UserRead
from app.services.post_processing import build_summary, find_keyword_matches, generate_tags
from app.services.photo_storage import get_photo_storage, image_content_type, photo_filename

router = APIRouter()
PASSWORD_ITERATIONS = 210_000


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
                col(Post.title).ilike(pattern),
                col(Post.content).ilike(pattern),
                col(Post.summary).ilike(pattern),
            )
        )

    if tag:
        filters.append(post_tag_filter(session, tag))

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


@router.delete("/links/{link_id}", status_code=204)
async def delete_friend_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    link = session.get(FriendLink, link_id)
    if link is None:
        raise HTTPException(status_code=404, detail="Link not found")
    if link.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this link")
    session.delete(link)
    session.commit()


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
    storage=Depends(get_photo_storage),
) -> Photo:
    content_type = image_content_type(file.filename or "image.jpg", file.content_type)
    content = await file.read(settings.photo_max_bytes + 1)
    if not 0 < len(content) <= settings.photo_max_bytes:
        raise HTTPException(status_code=413, detail="Photo must be between 1 byte and 20 MiB")
    filename = photo_filename(current_user.id, content_type)
    await run_in_threadpool(storage.put, filename, content, content_type)
    return await run_in_threadpool(_save_photo, session, storage, current_user.id, filename, title, description)


def _save_photo(session, storage, owner_id, filename, title, description) -> Photo:
    photo = Photo(
        owner_id=owner_id,
        title=title.strip(),
        image_url=filename,
        description=description.strip(),
    )
    try:
        session.add(photo)
        session.commit()
    except IntegrityError:
        session.rollback()
        # A concurrent completion may have already saved this object; never delete it.
        if session.exec(select(Photo).where(Photo.image_url == filename)).first() is not None:
            raise HTTPException(status_code=409, detail="Upload has already been completed")
        with suppress(HTTPException, OSError):
            storage.delete(filename)
        raise
    except Exception:
        session.rollback()
        with suppress(HTTPException, OSError):
            storage.delete(filename)
        raise
    session.refresh(photo)
    return photo


@router.post("/photos/upload-url")
def prepare_photo_upload(
    payload: PhotoUploadRequest,
    current_user: User = Depends(get_current_user),
    storage=Depends(get_photo_storage),
) -> dict:
    content_type = image_content_type(payload.filename, payload.content_type)
    if not storage.remote:
        return {"storage": "local"}
    filename = photo_filename(current_user.id, content_type)
    return {
        "storage": "r2",
        "filename": filename,
        "content_type": content_type,
        "upload_url": storage.upload_url(filename, content_type),
    }


@router.post("/photos/complete", response_model=PhotoRead, status_code=201)
def complete_photo_upload(
    payload: PhotoUploadComplete,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    storage=Depends(get_photo_storage),
) -> Photo:
    if not storage.remote:
        raise HTTPException(status_code=409, detail="Direct uploads require R2 storage")
    if not re.fullmatch(rf"{current_user.id}_[0-9a-f]{{32}}\.(jpg|png|webp|gif)", payload.filename):
        raise HTTPException(status_code=403, detail="Not authorized to complete this upload")
    if session.exec(select(Photo).where(Photo.image_url == payload.filename)).first() is not None:
        raise HTTPException(status_code=409, detail="Upload has already been completed")
    storage.validate_upload(payload.filename)
    return _save_photo(session, storage, current_user.id, payload.filename, payload.title, payload.description)


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
def get_photo_file(filename: str, storage=Depends(get_photo_storage)) -> Response:
    return storage.response(filename)


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    storage=Depends(get_photo_storage),
) -> None:
    photo = session.exec(select(Photo).where(Photo.id == photo_id, Photo.owner_id == current_user.id)).first()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not photo.image_url.startswith("data:"):
        storage.delete(photo.image_url)

    session.delete(photo)
    session.commit()
