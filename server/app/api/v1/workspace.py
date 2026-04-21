from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_admin_user
from app.core.response import success, paginated, error
from app.api.deps import pagination
from app.models.task import Task
from app.models.user import User
from app.schemas.common import PaginationParams

router = APIRouter()


@router.get("/tasks")
def list_tasks(
    type: str | None = None,
    status: str | None = None,
    pg: PaginationParams = Depends(pagination),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(Task)
    if type:
        query = query.filter(Task.type == type)
    if status:
        query = query.filter(Task.status == status)
    total = query.count()
    items = query.order_by(Task.created_at.desc()).offset(pg.offset).limit(pg.page_size).all()
    return paginated(items=[_serialize(t) for t in items], total=total, page=pg.page, page_size=pg.page_size)


@router.post("/tasks")
def create_task(
    name: str,
    type: str,
    payload: dict | None = None,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    task = Task(name=name, type=type, payload=payload)
    db.add(task)
    db.commit()
    db.refresh(task)
    return success(data=_serialize(task))


@router.put("/tasks/{task_id}/status")
def update_task_status(
    task_id: int,
    status: str,
    result: dict | None = None,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return error(code=404, message="Task not found")
    task.status = status
    if status == "running":
        task.started_at = datetime.now(timezone.utc)
    elif status in ("success", "failed"):
        task.completed_at = datetime.now(timezone.utc)
        task.result = result
    db.commit()
    db.refresh(task)
    return success(data=_serialize(task))


@router.get("/stats")
def workspace_stats(_: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Dashboard stats for workspace."""
    from app.models.project import Project
    from app.models.post import Post
    from app.models.skill import Skill
    return success(data={
        "projects_count": db.query(Project).count(),
        "posts_count": db.query(Post).filter(Post.published.is_(True)).count(),
        "skills_count": db.query(Skill).count(),
        "tasks_pending": db.query(Task).filter(Task.status == "pending").count(),
        "tasks_running": db.query(Task).filter(Task.status == "running").count(),
    })


def _serialize(t: Task) -> dict:
    return {
        "id": t.id, "name": t.name, "type": t.type, "status": t.status,
        "payload": t.payload, "result": t.result,
        "started_at": t.started_at.isoformat() if t.started_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "created_at": t.created_at.isoformat(),
    }
