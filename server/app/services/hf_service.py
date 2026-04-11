"""Hugging Face API integration service.

Handles: model/space info fetching, inference demo embedding.
"""

import httpx
from app.core.config import get_settings

settings = get_settings()


async def get_model_info(model_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.hf_api_url}/models/{model_id}",
            headers=_headers(),
        )
        resp.raise_for_status()
        m = resp.json()
        return {
            "id": m["modelId"],
            "pipeline_tag": m.get("pipeline_tag"),
            "tags": m.get("tags", []),
            "downloads": m.get("downloads", 0),
            "likes": m.get("likes", 0),
            "library_name": m.get("library_name"),
        }


async def get_space_info(space_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.hf_api_url}/spaces/{space_id}",
            headers=_headers(),
        )
        resp.raise_for_status()
        s = resp.json()
        return {
            "id": s["id"],
            "url": f"https://huggingface.co/spaces/{space_id}",
            "sdk": s.get("sdk"),
            "tags": s.get("tags", []),
            "likes": s.get("likes", 0),
        }


async def list_user_models(username: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.hf_api_url}/models",
            params={"author": username, "limit": 50},
            headers=_headers(),
        )
        resp.raise_for_status()
        return [
            {"id": m["modelId"], "pipeline_tag": m.get("pipeline_tag"), "downloads": m.get("downloads", 0)}
            for m in resp.json()
        ]


def _headers() -> dict:
    h = {}
    if settings.hf_token:
        h["Authorization"] = f"Bearer {settings.hf_token}"
    return h
