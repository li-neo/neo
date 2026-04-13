from datetime import datetime

from pydantic import BaseModel


class CliTokenCreate(BaseModel):
    name: str
    expires_in_days: int | None = 30


class CliTokenRevoke(BaseModel):
    token_id: int | None = None
    token_prefix: str | None = None


class CliTokenOut(BaseModel):
    id: int
    name: str
    token_prefix: str
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None
    expires_at: datetime | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

