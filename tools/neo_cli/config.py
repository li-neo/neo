from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path


DEFAULT_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_API_PREFIX = "/api/v1"
PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class NeoCliConfig:
    base_url: str = DEFAULT_BASE_URL
    api_prefix: str = DEFAULT_API_PREFIX
    token: str | None = None
    project_root: str | None = None


def config_dir() -> Path:
    explicit = os.environ.get("NEO_CLI_CONFIG_DIR")
    if explicit:
        return Path(explicit).expanduser()
    xdg = os.environ.get("XDG_CONFIG_HOME")
    base = Path(xdg) if xdg else Path.home() / ".config"
    return base / "neo-cli"


def fallback_config_dir() -> Path:
    return PROJECT_ROOT / ".neo-cli"


def config_path() -> Path:
    return config_dir() / "config.json"


def fallback_config_path() -> Path:
    return fallback_config_dir() / "config.json"


def candidate_config_paths() -> list[Path]:
    primary = config_path()
    fallback = fallback_config_path()
    return [primary] if primary == fallback else [primary, fallback]


def load_config() -> NeoCliConfig:
    path = next((candidate for candidate in candidate_config_paths() if candidate.exists()), None)
    if path is None:
        return NeoCliConfig(project_root=str(PROJECT_ROOT))

    data = json.loads(path.read_text(encoding="utf-8"))
    return NeoCliConfig(
        base_url=data.get("base_url") or DEFAULT_BASE_URL,
        api_prefix=data.get("api_prefix") or DEFAULT_API_PREFIX,
        token=data.get("token"),
        project_root=data.get("project_root") or str(PROJECT_ROOT),
    )


def save_config(config: NeoCliConfig) -> None:
    payload = asdict(config)
    payload["project_root"] = payload.get("project_root") or str(PROJECT_ROOT)

    for path in candidate_config_paths():
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            return
        except OSError:
            continue
    raise OSError("Unable to write NEO CLI config to system or project config directory")
