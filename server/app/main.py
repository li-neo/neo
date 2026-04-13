from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import get_engine, get_session_factory, Base
from app.core.response import error
from app.api.v1.router import api_router
from app.api.v2.router import api_v2_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    __import__("app.models")  # ensure all models registered
    Base.metadata.create_all(bind=get_engine())
    _seed_integrations()
    yield


app = FastAPI(
    title="Neo API",
    description="Personal workspace & portfolio backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)

app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(api_v2_router, prefix="/api/v2")

upload_path = Path(settings.upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.exception_handler(404)
async def not_found_handler(_request: Request, _exc):
    return JSONResponse(status_code=404, content=error(code=404, message="Not found"))


@app.exception_handler(500)
async def internal_error_handler(_request: Request, _exc):
    return JSONResponse(status_code=500, content=error(code=500, message="Internal server error"))


def _seed_integrations():
    """Pre-populate integration records on first startup."""
    from app.models.integration import Integration

    db = get_session_factory()()
    try:
        if db.query(Integration).count() > 0:
            return
        defaults = [
            Integration(name="github", display_name="GitHub", type="oauth"),
            Integration(name="huggingface", display_name="Hugging Face", type="api_key"),
            Integration(name="openclaw", display_name="OpenClaw", type="api_key"),
            Integration(name="mcp", display_name="MCP Service", type="mcp"),
        ]
        db.add_all(defaults)
        db.commit()
    finally:
        db.close()
