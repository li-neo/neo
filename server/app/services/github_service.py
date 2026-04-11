"""GitHub API integration service.

Handles: repo info fetching, stars/languages sync, webhook processing.
"""

import httpx
from app.core.config import get_settings

settings = get_settings()
GITHUB_API = "https://api.github.com"


async def get_user_repos(username: str, per_page: int = 30) -> list[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/users/{username}/repos",
            params={"per_page": per_page, "sort": "updated"},
            headers=_headers(),
        )
        resp.raise_for_status()
        return [
            {
                "name": r["name"],
                "full_name": r["full_name"],
                "description": r["description"],
                "html_url": r["html_url"],
                "stars": r["stargazers_count"],
                "language": r["language"],
                "topics": r.get("topics", []),
                "updated_at": r["updated_at"],
            }
            for r in resp.json()
        ]


async def get_repo_info(owner: str, repo: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=_headers())
        resp.raise_for_status()
        r = resp.json()
        return {
            "name": r["name"],
            "full_name": r["full_name"],
            "description": r["description"],
            "html_url": r["html_url"],
            "stars": r["stargazers_count"],
            "forks": r["forks_count"],
            "language": r["language"],
            "topics": r.get("topics", []),
        }


async def get_repo_languages(owner: str, repo: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/languages", headers=_headers())
        resp.raise_for_status()
        return resp.json()


def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    token = settings.github_client_secret
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h
