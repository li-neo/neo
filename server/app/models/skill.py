from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, func
from app.core.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, index=True)
    version = Column(String(30), default="0.1.0", nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    source_url = Column(String(500), nullable=True)
    install_command = Column(String(500), nullable=True)
    install_count = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="draft", nullable=False)  # draft / published / archived
    platform = Column(String(50), default="openclaw", nullable=False)  # openclaw / custom
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
