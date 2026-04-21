from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_admin_user, get_optional_user
from app.core.response import success, paginated, error
from app.api.deps import pagination
from app.models.skill import Skill
from app.models.user import User, UserRole
from app.schemas.skill import SkillCreate, SkillUpdate, SkillPublishRequest
from app.schemas.common import PaginationParams

router = APIRouter()


@router.get("")
def list_skills(
    category: str | None = None,
    platform: str | None = None,
    include_all: bool = False,
    pg: PaginationParams = Depends(pagination),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Skill)
    if not (include_all and current_user and current_user.role == UserRole.admin):
        query = query.filter(Skill.status == "published")
    if category:
        query = query.filter(Skill.category == category)
    if platform:
        query = query.filter(Skill.platform == platform)
    total = query.count()
    items = query.order_by(Skill.install_count.desc()).offset(pg.offset).limit(pg.page_size).all()
    return paginated(items=[_serialize(s) for s in items], total=total, page=pg.page, page_size=pg.page_size)


@router.get("/{slug}")
def get_skill(
    slug: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Skill).filter(Skill.slug == slug)
    if not (current_user and current_user.role == UserRole.admin):
        query = query.filter(Skill.status == "published")
    skill = query.first()
    if not skill:
        return error(code=404, message="Skill not found")
    return success(data=_serialize(skill))


@router.post("")
def create_skill(body: SkillCreate, user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    skill = Skill(**body.model_dump(), author_id=user.id)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return success(data=_serialize(skill))


@router.put("/{slug}")
@router.patch("/{slug}")
def update_skill(slug: str, body: SkillUpdate, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.slug == slug).first()
    if not skill:
        return error(code=404, message="Skill not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(skill, key, val)
    db.commit()
    db.refresh(skill)
    return success(data=_serialize(skill))


@router.delete("/{slug}")
def delete_skill(slug: str, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.slug == slug).first()
    if not skill:
        return error(code=404, message="Skill not found")
    db.delete(skill)
    db.commit()
    return success(message="Deleted")


@router.post("/publish")
def publish_skill(body: SkillPublishRequest, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Publish a skill to external platform (OpenClaw, etc.)."""
    skill = db.query(Skill).filter(Skill.id == body.skill_id).first()
    if not skill:
        return error(code=404, message="Skill not found")
    # TODO: call external platform API (openclaw_service.publish)
    skill.status = "published"
    skill.platform = body.platform
    db.commit()
    return success(data=_serialize(skill), message=f"Published to {body.platform}")


def _serialize(s: Skill) -> dict:
    return {
        "id": s.id, "slug": s.slug, "name": s.name, "description": s.description,
        "category": s.category, "version": s.version, "author_id": s.author_id,
        "source_url": s.source_url, "install_command": s.install_command,
        "install_count": s.install_count, "status": s.status, "platform": s.platform,
        "created_at": s.created_at.isoformat(), "updated_at": s.updated_at.isoformat(),
    }
