from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, func
from app.core.database import Base


class Integration(Base):
    """Third-party service integrations (GitHub, HuggingFace, OpenClaw, MCP, etc.)"""
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)  # github / huggingface / openclaw / mcp
    display_name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False)  # oauth / api_key / webhook / mcp
    enabled = Column(Boolean, default=False, nullable=False)
    config = Column(JSON, nullable=True)  # service-specific config
    credentials = Column(JSON, nullable=True)  # encrypted credentials
    status = Column(String(20), default="disconnected", nullable=False)  # connected / disconnected / error
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
