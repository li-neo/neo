from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.response import success, paginated, error
from app.api.deps import pagination
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostUpdate
from app.schemas.common import PaginationParams

router = APIRouter()


@router.get("")
def list_posts(
    tag: str | None = None,
    pg: PaginationParams = Depends(pagination),
    db: Session = Depends(get_db),
):
    query = db.query(Post).filter(Post.published.is_(True))
    if tag:
        query = query.filter(Post.tags.contains(tag))
    total = query.count()
    items = query.order_by(Post.created_at.desc()).offset(pg.offset).limit(pg.page_size).all()
    return paginated(items=[_serialize(p) for p in items], total=total, page=pg.page, page_size=pg.page_size)


@router.get("/{slug}")
def get_post(slug: str, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.slug == slug).first()
    if not post:
        return error(code=404, message="Post not found")
    post.views += 1
    db.commit()
    return success(data=_serialize(post))


@router.post("")
def create_post(body: PostCreate, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = Post(**body.model_dump())
    if post.content:
        post.reading_time = max(1, len(post.content) // 1000)
    db.add(post)
    db.commit()
    db.refresh(post)
    return success(data=_serialize(post))


@router.put("/{slug}")
def update_post(slug: str, body: PostUpdate, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.slug == slug).first()
    if not post:
        return error(code=404, message="Post not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(post, key, val)
    if post.content:
        post.reading_time = max(1, len(post.content) // 1000)
    db.commit()
    db.refresh(post)
    return success(data=_serialize(post))


@router.delete("/{slug}")
def delete_post(slug: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.slug == slug).first()
    if not post:
        return error(code=404, message="Post not found")
    db.delete(post)
    db.commit()
    return success(message="Deleted")


def _serialize(p: Post) -> dict:
    return {
        "id": p.id, "slug": p.slug, "title": p.title, "summary": p.summary,
        "content": p.content, "tags": p.tags, "cover_url": p.cover_url,
        "published": p.published, "reading_time": p.reading_time, "views": p.views,
        "created_at": p.created_at.isoformat(), "updated_at": p.updated_at.isoformat(),
    }
