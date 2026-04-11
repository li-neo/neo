from sqlalchemy import Column, Integer, String, DateTime, JSON, func
from app.core.database import Base


class Task(Base):
    """Automation tasks for workspace (coding, docs, devops, etc.)"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False, index=True)  # coding / docs / devops / skill / mcp
    status = Column(String(20), default="pending", nullable=False)  # pending / running / success / failed
    payload = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
