from sqlalchemy import Column, Integer, String, Text, DateTime, func
from app.core.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user / assistant
    content = Column(Text, nullable=False)
    visitor_id = Column(String(64), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(512), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
