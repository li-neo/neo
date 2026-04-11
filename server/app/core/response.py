"""Unified API response format for all endpoints.

Every API response follows this structure:
{
    "code": 0,          # 0 = success, non-zero = error code
    "message": "ok",    # Human-readable message
    "data": { ... },    # Response payload (null on error)
    "meta": { ... }     # Optional metadata (pagination, etc.)
}
"""

from typing import Any, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class ApiResponse(BaseModel, Generic[T]):
    code: int = 0
    message: str = "ok"
    data: T | None = None
    meta: dict[str, Any] | None = None


def success(data: Any = None, message: str = "ok", meta: dict | None = None) -> dict:
    return {"code": 0, "message": message, "data": data, "meta": meta}


def error(code: int = -1, message: str = "error", data: Any = None) -> dict:
    return {"code": code, "message": message, "data": data}


def paginated(
    items: list,
    total: int,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    total_pages = (total + page_size - 1) // page_size
    return success(
        data=items,
        meta={
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
            }
        },
    )
