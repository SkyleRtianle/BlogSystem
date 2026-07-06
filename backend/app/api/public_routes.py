from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlmodel import Session, col, func, or_, select

from app.api.routes import get_current_user
from app.db.session import get_session
from app.models.community import (
    Comment,
    CommentCreate,
    CommentList,
    CommentRead,
    FriendLinkList,
    Message,
    MessageCreate,
    MessageList,
    MessageRead,
    PhotoList,
)
from app.models.post import Post, PostList
from app.models.user import User

router = APIRouter()


def _get_user_by_username(username: str, session: Session) -> User:
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Posts ──

@router.get("/public/{username}/posts", response_model=PostList)
async def public_list_posts(
    username: str,
    keyword: str | None = Query(default=None, max_length=80),
    tag: str | None = Query(default=None, max_length=40),
    session: Session = Depends(get_session),
) -> PostList:
    user = _get_user_by_username(username, session)

    statement = select(Post).where(Post.owner_id == user.id).order_by(col(Post.created_at).desc())
    count_statement = select(func.count(Post.id)).where(Post.owner_id == user.id)

    if keyword:
        pattern = f"%{keyword.strip()}%"
        kw_filter = or_(
            col(Post.title).like(pattern),
            col(Post.content).like(pattern),
            col(Post.summary).like(pattern),
        )
        statement = statement.where(kw_filter)
        count_statement = count_statement.where(kw_filter)

    if tag:
        tag_filter = col(Post.tags).like(f"%{tag.strip()}%")
        statement = statement.where(tag_filter)
        count_statement = count_statement.where(tag_filter)

    posts = session.exec(statement).all()
    total = session.exec(count_statement).one()
    return PostList(posts=posts, total=total)


@router.get("/public/{username}/posts/{post_id}", response_model=Post)
async def public_get_post(
    username: str,
    post_id: int,
    session: Session = Depends(get_session),
) -> Post:
    user = _get_user_by_username(username, session)
    post = session.exec(select(Post).where(Post.id == post_id, Post.owner_id == user.id)).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ── Photos ──

@router.get("/public/{username}/photos", response_model=PhotoList)
async def public_list_photos(
    username: str,
    session: Session = Depends(get_session),
) -> PhotoList:
    from app.models.community import Photo
    user = _get_user_by_username(username, session)
    statement = select(Photo).where(Photo.owner_id == user.id).order_by(col(Photo.created_at).desc())
    photos = session.exec(statement).all()
    total = session.exec(select(func.count(Photo.id)).where(Photo.owner_id == user.id)).one()
    return PhotoList(photos=photos, total=total)


# ── Links ──

@router.get("/public/{username}/links", response_model=FriendLinkList)
async def public_list_links(
    username: str,
    session: Session = Depends(get_session),
) -> FriendLinkList:
    from app.models.community import FriendLink
    user = _get_user_by_username(username, session)
    statement = select(FriendLink).where(FriendLink.owner_id == user.id).order_by(col(FriendLink.created_at).desc())
    links = session.exec(statement).all()
    total = session.exec(select(func.count(FriendLink.id)).where(FriendLink.owner_id == user.id)).one()
    return FriendLinkList(links=links, total=total)


# ── Messages (guestbook) ──

@router.get("/public/{username}/messages", response_model=MessageList)
async def public_list_messages(
    username: str,
    session: Session = Depends(get_session),
) -> MessageList:
    user = _get_user_by_username(username, session)
    statement = select(Message).where(Message.owner_id == user.id).order_by(col(Message.created_at).desc())
    messages = session.exec(statement).all()
    total = session.exec(select(func.count(Message.id)).where(Message.owner_id == user.id)).one()
    return MessageList(messages=messages, total=total)


@router.post("/public/{username}/messages", response_model=MessageRead, status_code=201)
async def public_create_message(
    username: str,
    payload: MessageCreate,
    session: Session = Depends(get_session),
) -> Message:
    user = _get_user_by_username(username, session)
    message = Message(owner_id=user.id, author=payload.author.strip(), content=payload.content.strip())
    session.add(message)
    session.commit()
    session.refresh(message)
    return message


# ── Comments ──

@router.get("/public/posts/{post_id}/comments", response_model=CommentList)
async def public_list_comments(
    post_id: int,
    session: Session = Depends(get_session),
) -> CommentList:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    # Get top-level comments first
    statement = select(Comment).where(
        Comment.post_id == post_id,
        Comment.parent_id == None
    ).order_by(col(Comment.created_at).desc())
    top_comments = session.exec(statement).all()

    # Get all replies
    all_replies = session.exec(
        select(Comment).where(
            Comment.post_id == post_id,
            Comment.parent_id != None
        ).order_by(col(Comment.created_at).asc())
    ).all()

    # Nest replies under parents
    reply_map: dict[int, list[Comment]] = {}
    for reply in all_replies:
        if reply.parent_id is not None:
            reply_map.setdefault(reply.parent_id, []).append(reply)

    result: list[Comment] = []
    for comment in top_comments:
        result.append(comment)
        result.extend(reply_map.get(comment.id, []))

    total = session.exec(select(func.count(Comment.id)).where(Comment.post_id == post_id)).one()
    return CommentList(comments=result, total=total)


@router.post("/public/posts/{post_id}/comments", response_model=CommentRead, status_code=201)
async def public_create_comment(
    post_id: int,
    payload: CommentCreate,
    session: Session = Depends(get_session),
) -> Comment:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    if payload.parent_id is not None:
        parent = session.get(Comment, payload.parent_id)
        if parent is None or parent.post_id != post_id:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = Comment(
        post_id=post_id,
        owner_id=post.owner_id,
        parent_id=payload.parent_id,
        author=payload.author.strip(),
        content=payload.content.strip(),
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment


# ── Comment delete (auth required, owner only) ──

@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    comment = session.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    session.delete(comment)
    session.commit()
