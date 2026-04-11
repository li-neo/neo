import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from app.core.config import get_settings
from app.core.security import get_admin_user
from app.core.response import success

router = APIRouter()
settings = get_settings()

ALLOWED_IMAGE = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
ALLOWED_VIDEO = {".mp4", ".webm", ".mov"}
ALLOWED_DOC = {".pdf", ".md", ".markdown", ".txt", ".html"}
ALLOWED = ALLOWED_IMAGE | ALLOWED_VIDEO | ALLOWED_DOC


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    _admin=Depends(get_admin_user),
):
    if not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No filename")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"File type {ext} not allowed")

    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > settings.max_upload_mb:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds {settings.max_upload_mb}MB limit")

    upload_root = Path(settings.upload_dir)
    sub = "images" if ext in ALLOWED_IMAGE else "videos" if ext in ALLOWED_VIDEO else "docs"
    dest_dir = upload_root / sub
    dest_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = dest_dir / unique_name
    dest.write_bytes(data)

    url = f"/uploads/{sub}/{unique_name}"
    return success(data={"url": url, "filename": file.filename, "size": len(data), "type": sub})
