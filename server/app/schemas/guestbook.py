from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.user import UserOut


class GuestbookCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    nickname: str | None = Field(None, max_length=50)


class GuestbookUpdate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    nickname: str | None = Field(None, max_length=50)


class GuestbookOut(BaseModel):
    id: int
    user_id: int | None = None
    nickname: str | None = None
    visitor_id: str | None = None
    message: str
    created_at: datetime
    user: UserOut | None = None

    model_config = {"from_attributes": True}
