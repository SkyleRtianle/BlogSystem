from fastapi import APIRouter, Depends, HTTPException, Query
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
    PhotoCreate,
    PhotoList,
    PhotoRead,
)
from app.models.post import Post, PostCreate, PostList, PostRead
from app.services.post_processing import build_summary, find_keyword_matches, generate_tags

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/site")
async def site_info() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "env": settings.app_env,
    }


@router.post("/posts", response_model=PostRead, status_code=201)
async def create_post(payload: PostCreate, session: Session = Depends(get_session)) -> Post:
    plain_search_text = f"{payload.title}\n{payload.content}"
    keyword_matches = find_keyword_matches(plain_search_text, payload.keywords)
    post = Post(
        title=payload.title.strip(),
        content=payload.content.strip(),
        category=payload.category.strip() or "未分类",
        summary=build_summary(payload.content),
        tags=generate_tags(payload.title, payload.content, keyword_matches),
        keyword_matches=keyword_matches,
    )

    session.add(post)
    session.commit()
    session.refresh(post)
    return post


@router.get("/posts", response_model=PostList)
async def list_posts(
    keyword: str | None = Query(default=None, max_length=80),
    tag: str | None = Query(default=None, max_length=40),
    session: Session = Depends(get_session),
) -> PostList:
    statement = select(Post).order_by(col(Post.created_at).desc())
    count_statement = select(func.count(Post.id))

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


@router.get("/posts/{post_id}", response_model=PostRead)
async def get_post(post_id: int, session: Session = Depends(get_session)) -> Post:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/links", response_model=FriendLinkRead, status_code=201)
async def create_friend_link(
    payload: FriendLinkCreate,
    session: Session = Depends(get_session),
) -> FriendLink:
    link = FriendLink(
        name=payload.name.strip(),
        url=payload.url.strip(),
        description=payload.description.strip(),
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.get("/links", response_model=FriendLinkList)
async def list_friend_links(session: Session = Depends(get_session)) -> FriendLinkList:
    statement = select(FriendLink).order_by(col(FriendLink.created_at).desc())
    links = session.exec(statement).all()
    total = session.exec(select(func.count(FriendLink.id))).one()
    return FriendLinkList(links=links, total=total)


@router.post("/messages", response_model=MessageRead, status_code=201)
async def create_message(payload: MessageCreate, session: Session = Depends(get_session)) -> Message:
    message = Message(author=payload.author.strip(), content=payload.content.strip())
    session.add(message)
    session.commit()
    session.refresh(message)
    return message


@router.get("/messages", response_model=MessageList)
async def list_messages(session: Session = Depends(get_session)) -> MessageList:
    statement = select(Message).order_by(col(Message.created_at).desc())
    messages = session.exec(statement).all()
    total = session.exec(select(func.count(Message.id))).one()
    return MessageList(messages=messages, total=total)


@router.post("/photos", response_model=PhotoRead, status_code=201)
async def create_photo(payload: PhotoCreate, session: Session = Depends(get_session)) -> Photo:
    photo = Photo(
        title=payload.title.strip(),
        image_url=payload.image_url.strip(),
        description=payload.description.strip(),
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


@router.get("/photos", response_model=PhotoList)
async def list_photos(session: Session = Depends(get_session)) -> PhotoList:
    statement = select(Photo).order_by(col(Photo.created_at).desc())
    photos = session.exec(statement).all()
    total = session.exec(select(func.count(Photo.id))).one()
    return PhotoList(photos=photos, total=total)
