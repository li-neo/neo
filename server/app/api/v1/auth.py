from datetime import timedelta
import secrets
import string

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import httpx

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, generate_cli_token, get_admin_user, get_current_user, utc_now_naive
from app.core.response import success, error
from app.models.cli_auth_session import CliAuthSession
from app.models.cli_token import CliToken
from app.models.user import User, UserRole
from app.schemas.cli_auth import CliBootstrapApprove, CliBootstrapStart
from app.schemas.auth import CliTokenCreate, CliTokenRevoke

router = APIRouter()
settings = get_settings()
BOOTSTRAP_TTL_MINUTES = 15
BOOTSTRAP_POLL_INTERVAL_SECONDS = 3


def _bootstrap_user_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    raw = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"


def _bootstrap_verification_url(session_id: str, user_code: str) -> str:
    base = settings.site_url.rstrip("/")
    return f"{base}/cli-auth?session_id={session_id}&user_code={user_code}"


def _expire_bootstrap_session(record: CliAuthSession, db: Session) -> CliAuthSession:
    if record.status in {"pending", "approved"} and record.expires_at <= utc_now_naive():
        record.status = "expired"
        db.commit()
        db.refresh(record)
    return record


def _create_cli_token_record(
    *,
    user_id: int,
    name: str,
    expires_in_days: int | None,
    db: Session,
) -> tuple[CliToken, str]:
    raw_token, token_prefix, token_hash = generate_cli_token()
    expires_at = None
    if expires_in_days is not None and expires_in_days > 0:
        expires_at = utc_now_naive() + timedelta(days=expires_in_days)

    record = CliToken(
        user_id=user_id,
        name=name.strip(),
        token_prefix=token_prefix,
        token_hash=token_hash,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, raw_token


@router.get("/github/login")
def github_login():
    """Redirect URL for GitHub OAuth."""
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={settings.github_redirect_uri}"
        f"&scope=read:user,user:email"
    )
    return success(data={"url": url})


@router.get("/github/callback")
async def github_callback(
    code: str = Query(...),
    redirect_uri: str = Query(""),
    db: Session = Depends(get_db),
):
    """Handle GitHub OAuth callback, create/update user, return JWT."""
    async with httpx.AsyncClient() as client:
        payload: dict = {
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
            "redirect_uri": settings.github_redirect_uri,
        }
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json=payload,
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return error(code=401, message="GitHub OAuth failed")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        gh_user = user_resp.json()

        # Public email may be null; fetch from /user/emails for private primary email
        gh_email = gh_user.get("email") or ""
        if not gh_email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if emails_resp.status_code == 200:
                for em in emails_resp.json():
                    if em.get("primary"):
                        gh_email = em["email"]
                        break
    gh_login = gh_user["login"]

    admin_list = [u.strip().lower() for u in settings.admin_github_users.split(",") if u.strip()]
    is_admin = (
        gh_login.lower() in admin_list
        or (gh_email and gh_email.lower() in admin_list)
    )

    user = db.query(User).filter(User.github_id == gh_user["id"]).first()
    if user is None:
        role = UserRole.admin if is_admin else UserRole.user
        user = User(
            github_id=gh_user["id"],
            username=gh_login,
            display_name=gh_user.get("name"),
            avatar_url=gh_user.get("avatar_url"),
            email=gh_email,
            bio=gh_user.get("bio"),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.avatar_url = gh_user.get("avatar_url")
        user.display_name = gh_user.get("name")
        if is_admin and user.role != UserRole.admin:
            user.role = UserRole.admin
        elif not is_admin and user.role == UserRole.admin:
            user.role = UserRole.user
        db.commit()

    jwt_token = create_access_token(data={"sub": str(user.id)})
    return success(data={"access_token": jwt_token, "token_type": "bearer", "user": {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "role": user.role.value,
    }})


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return success(data={
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "email": current_user.email,
        "role": current_user.role.value,
    })


@router.post("/cli-bootstrap/start")
def start_cli_bootstrap(body: CliBootstrapStart, db: Session = Depends(get_db)):
    session_id = secrets.token_urlsafe(24)
    user_code = _bootstrap_user_code()
    expires_at = utc_now_naive() + timedelta(minutes=BOOTSTRAP_TTL_MINUTES)
    record = CliAuthSession(
        session_id=session_id,
        user_code=user_code,
        status="pending",
        requested_token_name=body.token_name.strip(),
        requested_expires_in_days=body.expires_in_days,
        client_name=(body.client_name or "").strip() or None,
        expires_at=expires_at,
    )
    db.add(record)
    db.commit()
    return success(data={
        "session_id": session_id,
        "user_code": user_code,
        "status": record.status,
        "verification_uri": f"{settings.site_url.rstrip('/')}/cli-auth",
        "verification_uri_complete": _bootstrap_verification_url(session_id, user_code),
        "poll_interval_seconds": BOOTSTRAP_POLL_INTERVAL_SECONDS,
        "expires_at": expires_at.isoformat(),
        "client_name": record.client_name,
        "token_name": record.requested_token_name,
    })


@router.get("/cli-bootstrap/{session_id}")
def get_cli_bootstrap_status(session_id: str, user_code: str = Query(...), db: Session = Depends(get_db)):
    record = db.query(CliAuthSession).filter(CliAuthSession.session_id == session_id).first()
    if record is None or record.user_code != user_code:
        return error(code=404, message="CLI bootstrap session not found")
    record = _expire_bootstrap_session(record, db)
    return success(data={
        "session_id": record.session_id,
        "user_code": record.user_code,
        "status": record.status,
        "client_name": record.client_name,
        "token_name": record.requested_token_name,
        "approved_at": record.approved_at.isoformat() if record.approved_at else None,
        "claimed_at": record.claimed_at.isoformat() if record.claimed_at else None,
        "expires_at": record.expires_at.isoformat(),
    })


@router.post("/cli-bootstrap/{session_id}/claim")
def claim_cli_bootstrap(session_id: str, user_code: str = Query(...), db: Session = Depends(get_db)):
    record = db.query(CliAuthSession).filter(CliAuthSession.session_id == session_id).first()
    if record is None or record.user_code != user_code:
        return error(code=404, message="CLI bootstrap session not found")
    record = _expire_bootstrap_session(record, db)
    if record.status == "pending":
        return error(code=42501, message="Authorization pending")
    if record.status == "expired":
        return error(code=41001, message="CLI bootstrap session expired")
    if record.status == "claimed" or record.claimed_at is not None:
        return error(code=40901, message="CLI bootstrap token already claimed")
    if record.status != "approved" or not record.issued_token:
        return error(code=40001, message="CLI bootstrap session not ready")

    record.status = "claimed"
    record.claimed_at = utc_now_naive()
    db.commit()
    return success(data={
        "token": record.issued_token,
        "token_prefix": record.token_prefix,
        "token_name": record.requested_token_name,
    })


@router.post("/cli-bootstrap/approve")
def approve_cli_bootstrap(
    body: CliBootstrapApprove,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    record = db.query(CliAuthSession).filter(CliAuthSession.session_id == body.session_id).first()
    if record is None or record.user_code != body.user_code.strip():
        return error(code=404, message="CLI bootstrap session not found")
    record = _expire_bootstrap_session(record, db)
    if record.status == "expired":
        return error(code=41001, message="CLI bootstrap session expired")
    if record.status in {"approved", "claimed"}:
        return success(data={
            "session_id": record.session_id,
            "status": record.status,
            "client_name": record.client_name,
            "token_name": record.requested_token_name,
            "approved_at": record.approved_at.isoformat() if record.approved_at else None,
        })

    token_record, raw_token = _create_cli_token_record(
        user_id=current_user.id,
        name=record.requested_token_name,
        expires_in_days=record.requested_expires_in_days,
        db=db,
    )
    record.status = "approved"
    record.token_prefix = token_record.token_prefix
    record.issued_token = raw_token
    record.approved_by_user_id = current_user.id
    record.approved_at = utc_now_naive()
    db.commit()
    return success(data={
        "session_id": record.session_id,
        "status": record.status,
        "client_name": record.client_name,
        "token_name": record.requested_token_name,
        "token_prefix": record.token_prefix,
        "approved_at": record.approved_at.isoformat() if record.approved_at else None,
    })


@router.get("/cli-tokens")
def list_cli_tokens(current_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    tokens = (
        db.query(CliToken)
        .filter(CliToken.user_id == current_user.id)
        .order_by(CliToken.created_at.desc())
        .all()
    )
    return success(data=[
        {
            "id": token.id,
            "name": token.name,
            "token_prefix": token.token_prefix,
            "last_used_at": token.last_used_at.isoformat() if token.last_used_at else None,
            "revoked_at": token.revoked_at.isoformat() if token.revoked_at else None,
            "expires_at": token.expires_at.isoformat() if token.expires_at else None,
            "is_active": token.is_active,
            "created_at": token.created_at.isoformat() if token.created_at else None,
        }
        for token in tokens
    ])


@router.post("/cli-tokens")
def create_cli_token(
    body: CliTokenCreate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    record, raw_token = _create_cli_token_record(
        user_id=current_user.id,
        name=body.name,
        expires_in_days=body.expires_in_days,
        db=db,
    )

    return success(data={
        "token": raw_token,
        "token_prefix": record.token_prefix,
        "name": record.name,
        "expires_at": record.expires_at.isoformat() if record.expires_at else None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    })


@router.post("/cli-tokens/revoke")
def revoke_cli_token(
    body: CliTokenRevoke,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(CliToken).filter(CliToken.user_id == current_user.id)
    if body.token_id is not None:
        query = query.filter(CliToken.id == body.token_id)
    elif body.token_prefix:
        query = query.filter(CliToken.token_prefix == body.token_prefix.strip())
    else:
        return error(code=400, message="token_id or token_prefix is required")

    record = query.first()
    if record is None:
        return error(code=404, message="CLI token not found")

    record.is_active = False
    record.revoked_at = utc_now_naive()
    db.commit()
    return success(data={"id": record.id, "token_prefix": record.token_prefix, "revoked": True})
