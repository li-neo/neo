from pydantic import BaseModel
from datetime import datetime


class PostCreate(BaseModel):
    slug: str
    title: str
    summary: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    cover_url: str | None = None
    published: bool = False


class PostUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    cover_url: str | None = None
    published: bool | None = None


class PostImportUrl(BaseModel):
    url: str


class PostOut(BaseModel):
    id: int
    slug: str
    title: str
    summary: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    cover_url: str | None = None
    published: bool
    reading_time: int
    views: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
