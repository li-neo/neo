from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.response import success, paginated
from app.api.deps import pagination
from app.models.guestbook import GuestbookEntry
from app.models.user import User
from app.schemas.guestbook import GuestbookCreate
from app.schemas.common import PaginationParams

router = APIRouter()


@router.get("")
def list_entries(pg: PaginationParams = Depends(pagination), db: Session = Depends(get_db)):
    total = db.query(GuestbookEntry).count()
    entries = (
        db.query(GuestbookEntry, User)
        .join(User, GuestbookEntry.user_id == User.id)
        .order_by(GuestbookEntry.created_at.desc())
        .offset(pg.offset)
        .limit(pg.page_size)
        .all()
    )
    items = [
        {
            "id": e.id, "message": e.message, "created_at": e.created_at.isoformat(),
            "user": {"id": u.id, "username": u.username, "avatar_url": u.avatar_url},
        }
        for e, u in entries
    ]
    return paginated(items=items, total=total, page=pg.page, page_size=pg.page_size)


@router.post("")
def create_entry(body: GuestbookCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = GuestbookEntry(user_id=user.id, message=body.message)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return success(data={
        "id": entry.id, "message": entry.message, "created_at": entry.created_at.isoformat(),
        "user": {"id": user.id, "username": user.username, "avatar_url": user.avatar_url},
    })
