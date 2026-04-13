import hashlib
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_admin_user, decode_access_token
from app.core.response import success, paginated
from app.api.deps import pagination
from app.models.guestbook import GuestbookEntry
from app.models.user import User
from app.schemas.guestbook import GuestbookCreate, GuestbookUpdate
from app.schemas.common import PaginationParams

router = APIRouter()
_optional_bearer = HTTPBearer(auto_error=False)


def _visitor_id(request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    raw = f"{ip}:{ua}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


@router.get("")
def list_entries(pg: PaginationParams = Depends(pagination), db: Session = Depends(get_db)):
    total = db.query(GuestbookEntry).count()
    entries = (
        db.query(GuestbookEntry)
        .outerjoin(User, GuestbookEntry.user_id == User.id)
        .order_by(GuestbookEntry.created_at.desc())
        .offset(pg.offset)
        .limit(pg.page_size)
        .all()
    )

    items = []
    user_cache: dict[int, User | None] = {}
    for e in entries:
        if e.user_id and e.user_id not in user_cache:
            user_cache[e.user_id] = db.query(User).filter(User.id == e.user_id).first()
        u = user_cache.get(e.user_id) if e.user_id else None

        if u:
            user_info = {"id": u.id, "username": u.username, "avatar_url": u.avatar_url}
        else:
            display = e.nickname or f"Visitor-{e.visitor_id[:6]}" if e.visitor_id else "Anonymous"
            user_info = {"id": 0, "username": display, "avatar_url": None}

        items.append({
            "id": e.id, "message": e.message, "created_at": e.created_at.isoformat(),
            "user": user_info,
        })
    return paginated(items=items, total=total, page=pg.page, page_size=pg.page_size)


@router.post("")
def create_entry(
    body: GuestbookCreate,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    db: Session = Depends(get_db),
):
    user = None
    if credentials and credentials.credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            uid = int(payload.get("sub", 0))
            user = db.query(User).filter(User.id == uid).first()
        except Exception:
            pass

    vid = _visitor_id(request)

    entry = GuestbookEntry(
        user_id=user.id if user else None,
        nickname=body.nickname if not user else None,
        visitor_id=vid if not user else None,
        message=body.message,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    if user:
        user_info = {"id": user.id, "username": user.username, "avatar_url": user.avatar_url}
    else:
        display = body.nickname or f"Visitor-{vid[:6]}"
        user_info = {"id": 0, "username": display, "avatar_url": None}

    return success(data={
        "id": entry.id, "message": entry.message, "created_at": entry.created_at.isoformat(),
        "user": user_info,
    })


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, _admin=Depends(get_admin_user), db: Session = Depends(get_db)):
    entry = db.query(GuestbookEntry).filter(GuestbookEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return success(message="Deleted")


@router.put("/{entry_id}")
@router.patch("/{entry_id}")
def update_entry(
    entry_id: int,
    body: GuestbookUpdate,
    _admin=Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    entry = db.query(GuestbookEntry).filter(GuestbookEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    entry.message = body.message
    if entry.user_id is None:
        entry.nickname = body.nickname
    db.add(entry)
    db.commit()
    db.refresh(entry)

    user = db.query(User).filter(User.id == entry.user_id).first() if entry.user_id else None
    if user:
        user_info = {"id": user.id, "username": user.username, "avatar_url": user.avatar_url}
    else:
        display = entry.nickname or f"Visitor-{entry.visitor_id[:6]}" if entry.visitor_id else "Anonymous"
        user_info = {"id": 0, "username": display, "avatar_url": None}

    return success(data={
        "id": entry.id,
        "message": entry.message,
        "created_at": entry.created_at.isoformat(),
        "user": user_info,
    })
