from pydantic import BaseModel
from datetime import datetime


class UserOut(BaseModel):
    id: int
    github_id: int
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    email: str | None = None
    bio: str | None = None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
