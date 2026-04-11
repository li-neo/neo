from pydantic import BaseModel
from datetime import datetime
from app.schemas.user import UserOut


class GuestbookCreate(BaseModel):
    message: str


class GuestbookOut(BaseModel):
    id: int
    user_id: int
    message: str
    created_at: datetime
    user: UserOut | None = None

    model_config = {"from_attributes": True}
