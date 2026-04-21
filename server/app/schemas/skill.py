from pydantic import BaseModel
from datetime import datetime
from typing import Any


class SkillCreate(BaseModel):
    slug: str
    name: str
    description: str | None = None
    category: str
    version: str = "0.1.0"
    source_url: str | None = None
    install_command: str | None = None
    status: str = "published"
    platform: str = "openclaw"
    metadata_: dict[str, Any] | None = None


class SkillUpdate(BaseModel):
    slug: str | None = None
    name: str | None = None
    description: str | None = None
    category: str | None = None
    version: str | None = None
    source_url: str | None = None
    install_command: str | None = None
    status: str | None = None
    platform: str | None = None
    metadata_: dict[str, Any] | None = None


class SkillOut(BaseModel):
    id: int
    slug: str
    name: str
    description: str | None = None
    category: str
    version: str
    author_id: int | None = None
    source_url: str | None = None
    install_command: str | None = None
    install_count: int
    status: str
    platform: str
    metadata_: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SkillPublishRequest(BaseModel):
    """Publish a skill to a platform (e.g. OpenClaw)."""
    skill_id: int
    platform: str = "openclaw"
    notes: str | None = None
