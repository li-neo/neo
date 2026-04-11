import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import httpx
from app.core.database import get_db
from app.core.security import get_admin_user
from app.core.response import success, error
from app.models.project import Project
from app.models.user import User
from pydantic import BaseModel, Field
from app.core.config import get_settings

router = APIRouter()


def _github_headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    token = get_settings().github_client_secret
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _slugify_repo_name(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "project"


def _detect_category(description: str | None, topics: list[str]) -> str:
    tset = {t.lower() for t in topics}
    blob = " ".join([description or "", *topics]).lower()
    if (
        "llm" in tset
        or "language-model" in tset
        or "language-model" in blob
        or re.search(r"\bllm\b", blob)
    ):
        return "llm"
    if "vla" in tset or "autonomous" in blob or "driving" in blob:
        return "vla"
    if "multimodal" in tset or "multimodal" in blob:
        return "multimodal"
    if "world-model" in tset or "world-model" in blob or "world model" in blob:
        return "world_model"
    return "tool"


def _tech_stack(language: str | None, topics: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in ([language] if language else []) + (topics or []):
        if not item:
            continue
        key = item.lower()
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


def _opengraph_cover_url(client: httpx.Client, full_name: str) -> str | None:
    path = quote(full_name, safe="/")
    url = f"https://opengraph.githubassets.com/1/{path}"
    try:
        r = client.head(url, follow_redirects=True, timeout=15.0)
        if r.status_code == 200:
            return str(r.url)
    except httpx.HTTPError:
        pass
    return None


@router.get("/repos")
def list_github_repos(
    username: str | None = Query(None, description="GitHub username; defaults to admin username"),
    admin: User = Depends(get_admin_user),
):
    effective = (username or "").strip() or None
    if effective is None:
        effective = admin.username

    all_items: list[dict] = []
    with httpx.Client(timeout=30.0) as client:
        page = 1
        while True:
            resp = client.get(
                f"https://api.github.com/users/{quote(effective, safe='')}/repos",
                params={"per_page": 100, "sort": "updated", "page": page},
                headers=_github_headers(),
            )
            if resp.status_code != 200:
                return error(
                    code=resp.status_code if resp.status_code < 500 else 502,
                    message=f"GitHub API error: {resp.text[:200]}",
                )
            batch = resp.json()
            if not batch:
                break
            for r in batch:
                if r.get("private"):
                    continue
                topics = r.get("topics") or []
                all_items.append(
                    {
                        "name": r["name"],
                        "full_name": r["full_name"],
                        "description": r.get("description"),
                        "html_url": r["html_url"],
                        "language": r.get("language"),
                        "stargazers_count": r.get("stargazers_count", 0),
                        "topics": topics,
                        "homepage": r.get("homepage") or None,
                        "default_branch": r.get("default_branch"),
                        "updated_at": r.get("updated_at"),
                    }
                )
            if len(batch) < 100:
                break
            page += 1

    return success(data=all_items)


class RepoImportItem(BaseModel):
    full_name: str
    title: str | None = None
    category: str | None = None


class RepoImportBody(BaseModel):
    repos: list[RepoImportItem] = Field(..., min_length=1)


@router.post("/import")
def import_github_repos(
    body: RepoImportBody,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    created: list[dict] = []
    skipped: list[dict] = []
    failed: list[dict] = []

    with httpx.Client(timeout=45.0) as client:
        for item in body.repos:
            full_name = item.full_name.strip()
            if not full_name or "/" not in full_name:
                failed.append({"full_name": full_name, "error": "invalid full_name"})
                continue

            resp = client.get(
                f"https://api.github.com/repos/{quote(full_name, safe='/')}",
                headers=_github_headers(),
            )
            if resp.status_code != 200:
                failed.append(
                    {
                        "full_name": full_name,
                        "error": f"GitHub API {resp.status_code}: {resp.text[:200]}",
                    }
                )
                continue

            r = resp.json()
            name = r.get("name") or full_name.split("/")[-1]
            slug = _slugify_repo_name(name)

            existing = db.query(Project).filter(Project.slug == slug).first()
            if existing:
                skipped.append({"full_name": full_name, "reason": "slug already exists", "slug": slug})
                continue

            topics = r.get("topics") or []
            language = r.get("language")
            description = r.get("description")
            category = item.category or _detect_category(description, topics)

            cover_url = _opengraph_cover_url(client, full_name)
            title = (item.title or "").strip() or name
            homepage = (r.get("homepage") or "").strip() or None

            project = Project(
                slug=slug,
                title=title,
                description=description,
                category=category,
                tech_stack=_tech_stack(language, topics),
                cover_url=cover_url,
                demo_url=homepage,
                repo_url=r.get("html_url"),
                hf_url=None,
                featured=False,
                sort_order=0,
                status="published",
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            created.append(
                {
                    "id": project.id,
                    "slug": project.slug,
                    "title": project.title,
                    "full_name": full_name,
                }
            )

    return success(
        data={"created": created, "skipped": skipped, "failed": failed},
        message="Import finished",
    )
