"""MCP (Model Context Protocol) service endpoint.

Provides a unified gateway for MCP-compatible tool/service calls.
External MCP clients can call this endpoint to invoke registered tools.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.response import success, error
from app.models.user import User
from app.schemas.common import MCPRequest

router = APIRouter()
settings = get_settings()

# Registry of available MCP tools/methods
MCP_TOOLS: dict[str, dict] = {
    "list_projects": {
        "description": "List all published projects",
        "handler": "_mcp_list_projects",
    },
    "list_skills": {
        "description": "List all published skills",
        "handler": "_mcp_list_skills",
    },
    "get_project": {
        "description": "Get a project by slug",
        "params": {"slug": "string"},
        "handler": "_mcp_get_project",
    },
    "get_skill": {
        "description": "Get a skill by slug",
        "params": {"slug": "string"},
        "handler": "_mcp_get_skill",
    },
    "create_task": {
        "description": "Create an automation task",
        "params": {"name": "string", "type": "string", "payload": "object"},
        "handler": "_mcp_create_task",
    },
}


@router.get("/tools")
def list_tools():
    """List all available MCP tools (public, no auth required)."""
    if not settings.mcp_enabled:
        return error(code=503, message="MCP service is disabled")
    tools = [
        {"name": name, "description": info["description"], "params": info.get("params", {})}
        for name, info in MCP_TOOLS.items()
    ]
    return success(data=tools)


@router.post("/invoke")
def invoke_tool(req: MCPRequest, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Invoke an MCP tool by method name."""
    if not settings.mcp_enabled:
        return error(code=503, message="MCP service is disabled")

    tool = MCP_TOOLS.get(req.method)
    if not tool:
        return error(code=404, message=f"Unknown MCP method: {req.method}")

    handler_name = tool["handler"]
    handler = _MCP_HANDLERS.get(handler_name)
    if not handler:
        return error(code=500, message=f"Handler not implemented: {handler_name}")

    result = handler(db=db, params=req.params or {})
    return success(data=result)


# --- MCP Handler implementations ---

def _mcp_list_projects(db, params):
    from app.models.project import Project
    items = db.query(Project).filter(Project.status == "published").all()
    return [{"slug": p.slug, "title": p.title, "category": p.category} for p in items]


def _mcp_list_skills(db, params):
    from app.models.skill import Skill
    items = db.query(Skill).filter(Skill.status == "published").all()
    return [{"slug": s.slug, "name": s.name, "category": s.category} for s in items]


def _mcp_get_project(db, params):
    from app.models.project import Project
    p = db.query(Project).filter(Project.slug == params.get("slug")).first()
    if not p:
        return None
    return {"slug": p.slug, "title": p.title, "description": p.description, "category": p.category}


def _mcp_get_skill(db, params):
    from app.models.skill import Skill
    s = db.query(Skill).filter(Skill.slug == params.get("slug")).first()
    if not s:
        return None
    return {"slug": s.slug, "name": s.name, "description": s.description, "version": s.version}


def _mcp_create_task(db, params):
    from app.models.task import Task
    task = Task(name=params["name"], type=params["type"], payload=params.get("payload"))
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "name": task.name, "status": task.status}


_MCP_HANDLERS = {
    "_mcp_list_projects": _mcp_list_projects,
    "_mcp_list_skills": _mcp_list_skills,
    "_mcp_get_project": _mcp_get_project,
    "_mcp_get_skill": _mcp_get_skill,
    "_mcp_create_task": _mcp_create_task,
}
