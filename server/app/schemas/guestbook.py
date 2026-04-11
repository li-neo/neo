from pydantic import BaseModel
from datetime import datetime
from app.schemas.user import UserOut


class GuestbookCreate(BaseModel):
    message: str
    nickname: str | None = None


class GuestbookUpdate(BaseModel):
    message: str
    nickname: str | None = None


class GuestbookOut(BaseModel):
    id: int
    user_id: int | None = None
    nickname: str | None = None
    visitor_id: str | None = None
    message: str
    created_at: datetime
    user: UserOut | None = None

    model_config = {"from_attributes": True}
