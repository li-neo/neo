from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_admin_user, get_optional_user
from app.core.response import success, paginated, error
from app.api.deps import pagination
from app.models.project import Project
from app.models.user import User, UserRole
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.common import PaginationParams

router = APIRouter()


@router.get("")
def list_projects(
    category: str | None = None,
    featured: bool | None = None,
    include_all: bool = False,
    pg: PaginationParams = Depends(pagination),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Project)
    if not (include_all and current_user and current_user.role == UserRole.admin):
        query = query.filter(Project.status == "published")
    if category:
        query = query.filter(Project.category == category)
    if featured is not None:
        query = query.filter(Project.featured == featured)
    total = query.count()
    items = query.order_by(Project.sort_order.asc(), Project.created_at.desc()).offset(pg.offset).limit(pg.page_size).all()
    return paginated(items=[_serialize(p, truncate_desc=True) for p in items], total=total, page=pg.page, page_size=pg.page_size)


@router.get("/{slug}")
def get_project(
    slug: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Project).filter(Project.slug == slug)
    if not (current_user and current_user.role == UserRole.admin):
        query = query.filter(Project.status == "published")
    project = query.first()
    if not project:
        return error(code=404, message="Project not found")
    return success(data=_serialize(project))


@router.post("")
def create_project(body: ProjectCreate, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    project = Project(**body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return success(data=_serialize(project))


@router.put("/{slug}")
@router.patch("/{slug}")
def update_project(slug: str, body: ProjectUpdate, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.slug == slug).first()
    if not project:
        return error(code=404, message="Project not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(project, key, val)
    db.commit()
    db.refresh(project)
    return success(data=_serialize(project))


@router.delete("/{slug}")
def delete_project(slug: str, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.slug == slug).first()
    if not project:
        return error(code=404, message="Project not found")
    db.delete(project)
    db.commit()
    return success(message="Deleted")


def _serialize(p: Project, truncate_desc: bool = False) -> dict:
    desc = p.description
    if truncate_desc and desc and len(desc) > 300:
        desc = desc[:300] + "…"
    return {
        "id": p.id, "slug": p.slug, "title": p.title, "description": desc,
        "category": p.category, "tech_stack": p.tech_stack, "cover_url": p.cover_url,
        "demo_url": p.demo_url, "repo_url": p.repo_url, "hf_url": p.hf_url,
        "featured": p.featured, "sort_order": p.sort_order, "status": p.status,
        "created_at": p.created_at.isoformat(), "updated_at": p.updated_at.isoformat(),
    }
