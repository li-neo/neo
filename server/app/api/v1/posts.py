import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_admin_user, get_optional_user
from app.core.response import success, paginated, error
from app.api.deps import pagination
from app.models.post import Post
from app.models.user import User, UserRole
from app.schemas.post import PostCreate, PostImportUrl, PostUpdate
from app.schemas.common import PaginationParams
from app.services.post_importer import import_post_from_bytes, import_post_from_url

router = APIRouter()


@router.get("")
def list_posts(
    tag: str | None = None,
    include_all: bool = False,
    pg: PaginationParams = Depends(pagination),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Post)
    if not (include_all and current_user and current_user.role == UserRole.admin):
        query = query.filter(Post.published.is_(True))
    if tag:
        query = query.filter(Post.tags.contains(tag))
    total = query.count()
    items = query.order_by(Post.created_at.desc()).offset(pg.offset).limit(pg.page_size).all()
    return paginated(items=[_serialize(p) for p in items], total=total, page=pg.page, page_size=pg.page_size)


@router.get("/{slug}")
def get_post(
    slug: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Post).filter(Post.slug == slug)
    if not (current_user and current_user.role == UserRole.admin):
        query = query.filter(Post.published.is_(True))
    post = query.first()
    if not post:
        return error(code=404, message="Post not found")
    post.views += 1
    db.commit()
    return success(data=_serialize(post))


@router.post("")
def create_post(body: PostCreate, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    post = Post(**body.model_dump())
    if post.content:
        post.reading_time = max(1, len(post.content) // 1000)
    db.add(post)
    db.commit()
    db.refresh(post)
    return success(data=_serialize(post))


@router.post("/import/file")
async def import_post_file(file: UploadFile = File(...), _: User = Depends(get_admin_user)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    try:
        result = import_post_from_bytes(file.filename or "imported-document", data, file.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return success(data=result)


@router.post("/import/url")
def import_post_link(body: PostImportUrl, _: User = Depends(get_admin_user)):
    try:
        result = import_post_from_url(body.url)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch source: HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch source: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return success(data=result)


@router.put("/{slug}")
def update_post(slug: str, body: PostUpdate, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
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
def delete_post(slug: str, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
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
