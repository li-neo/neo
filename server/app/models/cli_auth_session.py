from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from app.core.database import Base


class CliAuthSession(Base):
    __tablename__ = "cli_auth_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), unique=True, nullable=False, index=True)
    user_code = Column(String(32), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="pending")
    requested_token_name = Column(String(120), nullable=False)
    requested_expires_in_days = Column(Integer, nullable=True)
    client_name = Column(String(200), nullable=True)
    token_prefix = Column(String(32), nullable=True)
    issued_token = Column(Text, nullable=True)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

