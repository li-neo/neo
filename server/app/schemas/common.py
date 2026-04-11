from pydantic import BaseModel
from typing import Any


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class IntegrationOut(BaseModel):
    id: int
    name: str
    display_name: str
    type: str
    enabled: bool
    status: str

    model_config = {"from_attributes": True}


class MCPRequest(BaseModel):
    """Standard MCP (Model Context Protocol) service request."""
    method: str
    params: dict[str, Any] | None = None
    context: dict[str, Any] | None = None


class MCPResponse(BaseModel):
    """Standard MCP service response."""
    result: Any = None
    error: str | None = None
