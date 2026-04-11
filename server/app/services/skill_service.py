"""Skill lifecycle service.

Handles: creation, validation, publishing to OpenClaw and other platforms.
"""

import httpx
from app.core.config import get_settings

settings = get_settings()


async def publish_to_openclaw(skill_data: dict) -> dict:
    """Publish a skill to the OpenClaw marketplace."""
    if not settings.openclaw_api_url:
        raise ValueError("OpenClaw API URL is not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.openclaw_api_url}/skills",
            json=skill_data,
            headers={
                "Authorization": f"Bearer {settings.openclaw_api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def list_openclaw_skills(page: int = 1, limit: int = 20) -> list[dict]:
    """Fetch skills from OpenClaw marketplace."""
    if not settings.openclaw_api_url:
        return []

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.openclaw_api_url}/skills",
            params={"page": page, "limit": limit},
            headers={"Authorization": f"Bearer {settings.openclaw_api_key}"},
        )
        resp.raise_for_status()
        return resp.json()


def validate_skill_manifest(manifest: dict) -> list[str]:
    """Validate a skill manifest before publishing. Returns list of errors."""
    errors = []
    required_fields = ["name", "description", "version"]
    for field in required_fields:
        if not manifest.get(field):
            errors.append(f"Missing required field: {field}")
    return errors
