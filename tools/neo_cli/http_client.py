from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from .config import NeoCliConfig


@dataclass
class CliResult:
    ok: bool
    status_code: int
    payload: dict[str, Any]


class NeoApiClient:
    def __init__(self, config: NeoCliConfig):
        self.config = config

    def _url(self, path: str) -> str:
        normalized = path if path.startswith("/") else f"/{path}"
        base = self.config.base_url.rstrip("/")
        if normalized.startswith("/api/"):
            return f"{base}{normalized}"
        if normalized.startswith(self.config.api_prefix):
            return f"{base}{normalized}"
        return f"{base}{self.config.api_prefix}{normalized}"

    def _headers(self, auth: bool, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if auth:
            # Admin JWT / 管理员 JWT，用于限制只有已认证用户可以进行写操作。
            if not self.config.token:
                raise RuntimeError("No CLI token configured. Run `neo auth login --token <jwt-or-pat>` first.")
            headers["Authorization"] = f"Bearer {self.config.token}"
        if extra:
            headers.update(extra)
        return headers

    def request(
        self,
        method: str,
        path: str,
        *,
        auth: bool = False,
        data: Any = None,
        files: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> CliResult:
        headers = self._headers(auth=auth)
        with httpx.Client(timeout=30.0) as client:
            response = client.request(
                method=method.upper(),
                url=self._url(path),
                headers=headers if not files else {k: v for k, v in headers.items() if k.lower() != "content-type"},
                json=data if data is not None and not files else None,
                files=files,
                params=params,
            )
        try:
            payload = response.json()
        except json.JSONDecodeError:
            payload = {"code": response.status_code, "message": response.text, "data": None}
        ok = response.is_success and payload.get("code", 0) == 0
        return CliResult(ok=ok, status_code=response.status_code, payload=payload)

    def upload_file(self, path: str, file_path: str, *, field: str = "file", auth: bool = True) -> CliResult:
        source = Path(file_path)
        with source.open("rb") as file_obj:
            return self.request("POST", path, auth=auth, files={field: (source.name, file_obj)})
