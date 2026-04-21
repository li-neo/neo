from pydantic import BaseModel
from datetime import datetime
from typing import Any


class ProjectCreate(BaseModel):
    slug: str
    title: str
    description: str | None = None
    category: str
    tech_stack: list[str] | None = None
    cover_url: str | None = None
    demo_url: str | None = None
    repo_url: str | None = None
    hf_url: str | None = None
    featured: bool = False
    sort_order: int = 0
    status: str = "published"
    metadata_: dict[str, Any] | None = None


class ProjectUpdate(BaseModel):
    slug: str | None = None
    title: str | None = None
    description: str | None = None
    category: str | None = None
    tech_stack: list[str] | None = None
    cover_url: str | None = None
    demo_url: str | None = None
    repo_url: str | None = None
    hf_url: str | None = None
    featured: bool | None = None
    sort_order: int | None = None
    status: str | None = None
    metadata_: dict[str, Any] | None = None


class ProjectOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str | None = None
    category: str
    tech_stack: list[str] | None = None
    cover_url: str | None = None
    demo_url: str | None = None
    repo_url: str | None = None
    hf_url: str | None = None
    featured: bool
    sort_order: int
    status: str
    metadata_: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
