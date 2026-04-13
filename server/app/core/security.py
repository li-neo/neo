from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db

security_scheme = HTTPBearer(auto_error=False)
settings = get_settings()
CLI_TOKEN_PREFIX = "neo_pat_"


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def generate_cli_token() -> tuple[str, str, str]:
    secret = secrets.token_urlsafe(32)
    raw = f"{CLI_TOKEN_PREFIX}{secret}"
    token_prefix = raw[:18]
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, token_prefix, token_hash


def hash_cli_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_cli_token(token: str) -> bool:
    return token.startswith(CLI_TOKEN_PREFIX)


def get_user_from_cli_token(token: str, db: Session):
    from app.models.cli_token import CliToken
    from app.models.user import User

    token_hash = hash_cli_token(token)
    now = utc_now_naive()
    cli_token = (
        db.query(CliToken)
        .filter(CliToken.token_hash == token_hash, CliToken.is_active.is_(True))
        .first()
    )
    if cli_token is None or cli_token.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid CLI token")
    if cli_token.expires_at and cli_token.expires_at < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="CLI token expired")

    cli_token.last_used_at = now
    db.commit()
    user = db.query(User).filter(User.id == cli_token.user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials
    if is_cli_token(token):
        return get_user_from_cli_token(token, db)

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    from app.models.user import User

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def get_admin_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(credentials, db)
    from app.models.user import UserRole
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
):
    """Returns the current user or None if not authenticated."""
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None
