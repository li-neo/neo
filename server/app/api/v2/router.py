from fastapi import APIRouter

from app.api.v1 import auth, guestbook, posts, projects, skills, uploads

api_v2_router = APIRouter()

# Public reads / 公共读接口保持资源化命名，便于未来前台渐进迁移。
api_v2_router.include_router(auth.router, prefix="/auth", tags=["Auth v2"])
api_v2_router.include_router(projects.router, prefix="/projects", tags=["Projects v2"])
api_v2_router.include_router(posts.router, prefix="/posts", tags=["Posts v2"])
api_v2_router.include_router(skills.router, prefix="/skills", tags=["Skills v2"])
api_v2_router.include_router(guestbook.router, prefix="/guestbook", tags=["Guestbook v2"])

admin_router = APIRouter(prefix="/admin")

# Admin aliases / 管理别名面向 CLI 与运维，兼容现有 v1 逻辑，后续可逐步替换为专用控制器。
admin_router.include_router(projects.router, prefix="/projects", tags=["Admin Projects v2"])
admin_router.include_router(posts.router, prefix="/posts", tags=["Admin Posts v2"])
admin_router.include_router(skills.router, prefix="/skills", tags=["Admin Skills v2"])
admin_router.include_router(guestbook.router, prefix="/guestbook", tags=["Admin Guestbook v2"])
admin_router.include_router(uploads.router, prefix="/uploads", tags=["Admin Uploads v2"])

ops_router = APIRouter(prefix="/ops", tags=["Ops v2"])


@ops_router.get("/health")
def v2_health():
    return {"status": "ok", "version": "0.1.0", "api": "v2"}


api_v2_router.include_router(admin_router)
api_v2_router.include_router(ops_router)

