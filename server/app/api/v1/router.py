from fastapi import APIRouter
from app.api.v1 import auth, projects, posts, skills, guestbook, workspace, integrations, mcp, uploads, chat, github_import

api_router = APIRouter()


@api_router.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "version": "0.1.0"}


api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(posts.router, prefix="/posts", tags=["Posts"])
api_router.include_router(skills.router, prefix="/skills", tags=["Skills"])
api_router.include_router(guestbook.router, prefix="/guestbook", tags=["Guestbook"])
api_router.include_router(workspace.router, prefix="/workspace", tags=["Workspace"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["Integrations"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["MCP"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(github_import.router, prefix="/github", tags=["GitHub Import"])
