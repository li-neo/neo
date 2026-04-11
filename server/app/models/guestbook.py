from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base


class GuestbookEntry(Base):
    __tablename__ = "guestbook"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    nickname = Column(String(100), nullable=True)
    visitor_id = Column(String(64), nullable=True, index=True)
    message = Column(String(1000), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
