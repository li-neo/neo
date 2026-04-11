from fastapi import APIRouter
from app.api.v1 import auth, projects, posts, skills, guestbook, workspace, integrations, mcp

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(posts.router, prefix="/posts", tags=["Posts"])
api_router.include_router(skills.router, prefix="/skills", tags=["Skills"])
api_router.include_router(guestbook.router, prefix="/guestbook", tags=["Guestbook"])
api_router.include_router(workspace.router, prefix="/workspace", tags=["Workspace"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["Integrations"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["MCP"])
