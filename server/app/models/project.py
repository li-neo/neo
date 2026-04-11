from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, func
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, index=True)  # llm / vla / multimodal / world_model / tool
    tech_stack = Column(JSON, nullable=True)  # ["Python", "PyTorch", ...]
    cover_url = Column(String(500), nullable=True)
    demo_url = Column(String(500), nullable=True)
    repo_url = Column(String(500), nullable=True)
    hf_url = Column(String(500), nullable=True)
    featured = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="published", nullable=False)  # draft / published / archived
    metadata_ = Column("metadata", JSON, nullable=True)  # extensible extra fields
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
