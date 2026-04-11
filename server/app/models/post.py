from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, func
from app.core.database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(300), unique=True, nullable=False, index=True)
    title = Column(String(300), nullable=False)
    summary = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)  # ["LLM", "Tutorial", ...]
    cover_url = Column(String(500), nullable=True)
    published = Column(Boolean, default=False, nullable=False)
    reading_time = Column(Integer, default=0, nullable=False)  # minutes
    views = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
