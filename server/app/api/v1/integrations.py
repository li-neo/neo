"""Third-party integrations API.

Unified interface for managing external service connections:
GitHub, Hugging Face, OpenClaw, and future services.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.response import success, error
from app.models.integration import Integration
from app.models.user import User

router = APIRouter()


@router.get("")
def list_integrations(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Integration).all()
    return success(data=[
        {
            "id": i.id, "name": i.name, "display_name": i.display_name,
            "type": i.type, "enabled": i.enabled, "status": i.status,
            "last_synced_at": i.last_synced_at.isoformat() if i.last_synced_at else None,
        }
        for i in items
    ])


@router.post("/{name}/connect")
def connect_integration(name: str, config: dict | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    integration = db.query(Integration).filter(Integration.name == name).first()
    if not integration:
        return error(code=404, message=f"Integration '{name}' not found")
    integration.enabled = True
    integration.status = "connected"
    if config:
        integration.config = config
    db.commit()
    return success(message=f"{integration.display_name} connected")


@router.post("/{name}/disconnect")
def disconnect_integration(name: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    integration = db.query(Integration).filter(Integration.name == name).first()
    if not integration:
        return error(code=404, message=f"Integration '{name}' not found")
    integration.enabled = False
    integration.status = "disconnected"
    db.commit()
    return success(message=f"{integration.display_name} disconnected")


@router.post("/{name}/sync")
async def sync_integration(name: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Trigger a sync for the given integration (pull repos, models, etc.)."""
    integration = db.query(Integration).filter(Integration.name == name).first()
    if not integration:
        return error(code=404, message=f"Integration '{name}' not found")
    if not integration.enabled:
        return error(code=400, message=f"{integration.display_name} is not connected")
    # TODO: dispatch to service layer (github_service.sync, hf_service.sync, etc.)
    return success(message=f"Sync started for {integration.display_name}")
