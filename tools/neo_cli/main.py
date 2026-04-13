from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from .config import NeoCliConfig, config_path, load_config, save_config
from .http_client import CliResult, NeoApiClient


class AuthRequiredError(RuntimeError):
    def __init__(self, payload: dict[str, Any]):
        super().__init__(payload.get("message", "Authentication required"))
        self.payload = payload


def print_json(data: Any) -> None:
    print(json.dumps(data, indent=2, ensure_ascii=False))


def parse_json_arg(raw: str | None, default: Any = None) -> Any:
    if raw is None:
        return default
    return json.loads(raw)


def merge_payload(base: dict[str, Any] | None, updates: dict[str, Any]) -> dict[str, Any]:
    payload = dict(base or {})
    for key, value in updates.items():
        if value is None:
            continue
        payload[key] = value
    return payload


def split_csv(raw: str | None) -> list[str] | None:
    if raw is None:
        return None
    items = [item.strip() for item in raw.split(",") if item.strip()]
    return items


def build_resource_payload(args: argparse.Namespace, action: str) -> dict[str, Any]:
    payload = parse_json_arg(getattr(args, "data", None), {}) or {}
    if getattr(args, "resource", None) == "projects":
        payload = merge_payload(payload, {
            "slug": getattr(args, "slug", None) if action == "create" else None,
            "title": getattr(args, "title", None),
            "description": getattr(args, "description", None),
            "category": getattr(args, "category", None),
            "tech_stack": split_csv(getattr(args, "tech_stack", None)),
            "cover_url": getattr(args, "cover_url", None),
            "demo_url": getattr(args, "demo_url", None),
            "repo_url": getattr(args, "repo_url", None),
            "hf_url": getattr(args, "hf_url", None),
            "status": getattr(args, "status", None),
            "sort_order": getattr(args, "sort_order", None),
            "featured": True if getattr(args, "featured", False) else (False if getattr(args, "not_featured", False) else None),
        })
    elif getattr(args, "resource", None) == "skills":
        payload = merge_payload(payload, {
            "slug": getattr(args, "slug", None) if action == "create" else None,
            "name": getattr(args, "name", None),
            "description": getattr(args, "description", None),
            "category": getattr(args, "category", None),
            "version": getattr(args, "version", None),
            "platform": getattr(args, "platform", None),
            "source_url": getattr(args, "source_url", None),
            "install_command": getattr(args, "install_command", None),
            "status": getattr(args, "status", None),
        })
    elif getattr(args, "resource", None) == "posts":
        payload = merge_payload(payload, {
            "slug": getattr(args, "slug", None) if action == "create" else None,
            "title": getattr(args, "title", None),
            "summary": getattr(args, "summary", None),
            "content": getattr(args, "content", None),
            "tags": split_csv(getattr(args, "tags", None)),
            "cover_url": getattr(args, "cover_url", None),
            "published": True if getattr(args, "published", False) else (False if getattr(args, "draft", False) else None),
        })
    elif getattr(args, "resource", None) == "guestbook":
        payload = merge_payload(payload, {
            "nickname": getattr(args, "nickname", None),
            "message": getattr(args, "message", None),
        })
    return payload


def project_root(config: NeoCliConfig) -> Path:
    if config.project_root:
        return Path(config.project_root)
    return Path(__file__).resolve().parents[2]


def run_script(root: Path, relative_path: str) -> int:
    script_path = root / relative_path
    return subprocess.call(["bash", str(script_path)], cwd=str(root))


def run_command(command: list[str], cwd: Path) -> int:
    return subprocess.call(command, cwd=str(cwd))


def neo_runtime_python(config: NeoCliConfig) -> str:
    root = project_root(config)
    venv_python = root / "server" / ".venv" / "bin" / "python"
    return str(venv_python) if venv_python.exists() else sys.executable


def neo_runtime_env(config: NeoCliConfig) -> dict[str, str]:
    root = project_root(config)
    env = os.environ.copy()
    pythonpath = env.get("PYTHONPATH", "")
    root_str = str(root)
    env["PYTHONPATH"] = f"{root_str}:{pythonpath}" if pythonpath else root_str
    return env


def bootstrap_log_path(config: NeoCliConfig, session_id: str) -> Path:
    root = project_root(config)
    log_dir = root / ".neo-cli" / "bootstrap"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / f"{session_id}.log"


def start_bootstrap_session(client: NeoApiClient, token_name: str, expires_in_days: int, client_name: str | None) -> CliResult:
    payload = {
        "token_name": token_name,
        "expires_in_days": expires_in_days,
        "client_name": client_name,
    }
    return client.request("POST", "/auth/cli-bootstrap/start", data=payload)


def wait_for_bootstrap_claim(
    client: NeoApiClient,
    config: NeoCliConfig,
    *,
    session_id: str,
    user_code: str,
    poll_seconds: int,
) -> int:
    while True:
        time.sleep(max(1, poll_seconds))
        status_result = client.request(
            "GET",
            f"/auth/cli-bootstrap/{session_id}",
            params={"user_code": user_code},
        )
        if not status_result.ok:
            return result_exit(status_result)

        status_data = status_result.payload.get("data") or {}
        status = status_data.get("status")
        if status == "pending":
            continue
        if status == "expired":
            print_json({
                "code": 41001,
                "message": "CLI bootstrap session expired before approval.",
                "data": status_data,
            })
            return 1
        if status in {"approved", "claimed"}:
            claim = client.request(
                "POST",
                f"/auth/cli-bootstrap/{session_id}/claim",
                params={"user_code": user_code},
            )
            if not claim.ok:
                return result_exit(claim)
            token = (claim.payload.get("data") or {}).get("token")
            if not token:
                print_json({"code": 40003, "message": "Bootstrap claim succeeded but token is missing.", "data": claim.payload.get("data")})
                return 1
            config.token = token
            save_config(config)
            print_json({
                "code": 0,
                "message": "CLI bootstrap authorization completed.",
                "data": {
                    "token_saved": True,
                    "config_path": str(config_path()),
                    "token_prefix": (claim.payload.get("data") or {}).get("token_prefix"),
                    "token_name": (claim.payload.get("data") or {}).get("token_name"),
                },
            })
            return 0


def spawn_bootstrap_waiter(
    config: NeoCliConfig,
    *,
    session_id: str,
    user_code: str,
    poll_seconds: int,
) -> tuple[int, Path]:
    root = project_root(config)
    log_path = bootstrap_log_path(config, session_id)
    command = [
        neo_runtime_python(config),
        "-m",
        "tools.neo_cli.main",
        "auth",
        "bootstrap-wait",
        "--session-id",
        session_id,
        "--user-code",
        user_code,
        "--poll-seconds",
        str(max(1, poll_seconds)),
    ]
    env = neo_runtime_env(config)
    with log_path.open("ab") as stream:
        process = subprocess.Popen(  # noqa: S603
            command,
            cwd=str(root),
            env=env,
            stdout=stream,
            stderr=stream,
            start_new_session=True,
        )
    return process.pid, log_path


def result_exit(result: CliResult) -> int:
    print_json(result.payload)
    return 0 if result.ok else 1


def auth_login_steps(config: NeoCliConfig) -> dict[str, Any]:
    config_file = config_path()
    # Fast auth guidance / 快速认证指引：未认证时立即返回明确步骤，避免 Agent 盲目重试后超时。
    return {
        "code": 40101,
        "message": "NEO CLI authentication required. Run one of the login flows below before using admin or skill-driven operations.",
        "data": {
            "authenticated": False,
            "token_configured": bool(config.token),
            "config_path": str(config_file),
            "recommended_method": "bootstrap",
            "methods": {
                "bootstrap": [
                    "neo auth bootstrap --client-name openclaw-ecs --token-name openclaw-operator",
                ],
                "admin_jwt": [
                    "neo auth login --token <your-jwt-token>",
                    "neo auth whoami",
                ],
                "cli_token": [
                    "neo auth login --token <your-admin-jwt>",
                    "neo auth token-create --name openclaw-operator --expires-in-days 30",
                    "neo auth login --token <neo-pat-token>",
                    "neo auth whoami",
                ],
            },
            "notes": [
                "For remote/cloud OpenClaw, prefer bootstrap auth so the host can initiate authorization and only return a browser approval link.",
                "If OpenClaw runs under the same macOS user, it reuses the same NEO CLI config automatically.",
                "Use a CLI token (neo_pat_...) for long-lived OpenClaw automation instead of a long-lived admin JWT.",
            ],
        },
    }


def ensure_auth(client: NeoApiClient) -> None:
    if not client.config.token:
        raise AuthRequiredError(auth_login_steps(client.config))


def handle_auth(args: argparse.Namespace, config: NeoCliConfig, client: NeoApiClient) -> int:
    if args.auth_cmd == "login":
        config.token = args.token.strip()
        save_config(config)
        print(f"Token saved to {config_path()}")
        return 0
    if args.auth_cmd == "logout":
        config.token = None
        save_config(config)
        print("CLI token removed.")
        return 0
    if args.auth_cmd == "whoami":
        if not client.config.token:
            print_json(auth_login_steps(config))
            return 1
        ensure_auth(client)
        return result_exit(client.request("GET", "/auth/me", auth=True))
    if args.auth_cmd == "status":
        payload = auth_login_steps(config)
        if not client.config.token:
            print_json(payload)
            return 1
        me = client.request("GET", "/auth/me", auth=True)
        if me.ok:
            payload["code"] = 0
            payload["message"] = "NEO CLI is authenticated."
            payload["data"] = {
                "authenticated": True,
                "token_configured": True,
                "config_path": str(config_path()),
                "identity": me.payload.get("data"),
            }
            print_json(payload)
            return 0
        print_json(me.payload)
        return 1
    if args.auth_cmd == "guide":
        print_json(auth_login_steps(config))
        return 0
    if args.auth_cmd == "bootstrap":
        started = start_bootstrap_session(client, args.token_name, args.expires_in_days, args.client_name)
        if not started.ok:
            return result_exit(started)

        info = started.payload.get("data") or {}
        if args.detach:
            session_id = info.get("session_id")
            user_code = info.get("user_code")
            poll_seconds = int(info.get("poll_interval_seconds") or 3)
            if not session_id or not user_code:
                print_json({"code": 40002, "message": "Bootstrap session started but response is incomplete.", "data": info})
                return 1
            pid, log_path = spawn_bootstrap_waiter(
                config,
                session_id=session_id,
                user_code=user_code,
                poll_seconds=poll_seconds,
            )
            print_json({
                "code": 0,
                "message": "Bootstrap authorization started. Approve in browser; the host will continue automatically.",
                "data": {
                    **info,
                    "waiter_started": True,
                    "waiter_pid": pid,
                    "waiter_log_path": str(log_path),
                },
            })
            return 0

        print_json(started.payload)
        if args.no_wait:
            return 0

        session_id = info.get("session_id")
        user_code = info.get("user_code")
        poll_seconds = int(info.get("poll_interval_seconds") or 3)
        if not session_id or not user_code:
            print_json({"code": 40002, "message": "Bootstrap session started but response is incomplete.", "data": info})
            return 1
        return wait_for_bootstrap_claim(
            client,
            config,
            session_id=session_id,
            user_code=user_code,
            poll_seconds=poll_seconds,
        )
    if args.auth_cmd == "bootstrap-wait":
        return wait_for_bootstrap_claim(
            client,
            config,
            session_id=args.session_id,
            user_code=args.user_code,
            poll_seconds=args.poll_seconds,
        )
    if args.auth_cmd == "github-url":
        return result_exit(client.request("GET", "/auth/github/login"))
    if args.auth_cmd == "token-list":
        ensure_auth(client)
        return result_exit(client.request("GET", "/auth/cli-tokens", auth=True))
    if args.auth_cmd == "token-create":
        ensure_auth(client)
        payload = {"name": args.name, "expires_in_days": args.expires_in_days}
        return result_exit(client.request("POST", "/auth/cli-tokens", auth=True, data=payload))
    if args.auth_cmd == "token-revoke":
        ensure_auth(client)
        payload = {"token_id": args.token_id, "token_prefix": args.token_prefix}
        return result_exit(client.request("POST", "/auth/cli-tokens/revoke", auth=True, data=payload))
    raise ValueError(f"Unsupported auth command: {args.auth_cmd}")


def handle_config(args: argparse.Namespace, config: NeoCliConfig) -> int:
    if args.config_cmd == "show":
        print_json({
            "base_url": config.base_url,
            "api_prefix": config.api_prefix,
            "project_root": config.project_root or str(project_root(config)),
            "token_configured": bool(config.token),
            "config_path": str(config_path()),
        })
        return 0
    if args.config_cmd == "set":
        if args.key not in {"base_url", "api_prefix", "project_root"}:
            raise ValueError(f"Unsupported config key: {args.key}")
        setattr(config, args.key, args.value)
        save_config(config)
        print(f"Updated {args.key}.")
        return 0
    raise ValueError(f"Unsupported config command: {args.config_cmd}")


def handle_system(args: argparse.Namespace, config: NeoCliConfig, client: NeoApiClient) -> int:
    root = project_root(config)
    if args.system_cmd == "start":
        return run_script(root, "infra/scripts/run-local.sh")
    if args.system_cmd == "stop":
        return run_script(root, "infra/scripts/stop-local.sh")
    if args.system_cmd == "restart":
        stop_code = run_script(root, "infra/scripts/stop-local.sh")
        if stop_code != 0:
            return stop_code
        return run_script(root, "infra/scripts/run-local.sh")
    if args.system_cmd == "health":
        backend = client.request("GET", "/health")
        print_json({"backend": backend.payload})
        return 0 if backend.ok else 1
    if args.system_cmd == "status":
        pid_dir = root / ".pids"
        server_pid = pid_dir / "server.pid"
        web_pid = pid_dir / "web.pid"
        print_json({
            "project_root": str(root),
            "server_pid": server_pid.read_text().strip() if server_pid.exists() else None,
            "web_pid": web_pid.read_text().strip() if web_pid.exists() else None,
            "backend_health": client.request("GET", "/health").payload,
        })
        return 0
    if args.system_cmd == "logs":
        pid_dir = root / ".pids"
        service = args.service
        target = pid_dir / ("server.log" if service == "server" else "web-start.log")
        if not target.exists():
            target = pid_dir / ("server.log" if service == "server" else "web.log")
        if not target.exists():
            print(f"No log file found for {service}.")
            return 1
        subprocess.call(["tail", "-n", str(args.lines), str(target)])
        return 0
    raise ValueError(f"Unsupported system command: {args.system_cmd}")


def handle_devops(args: argparse.Namespace, config: NeoCliConfig) -> int:
    root = project_root(config)
    if args.command == "install":
        web_dir = root / "apps" / "web"
        server_dir = root / "server"
        if (server_dir / ".venv" / "bin" / "python").exists():
            run_command([str(server_dir / ".venv" / "bin" / "python"), "-m", "pip", "install", "-e", "."], cwd=server_dir)
        else:
            print("Backend virtualenv missing. Please initialize server/.venv first.")
            return 1
        return run_command(["pnpm", "install"], cwd=web_dir)
    if args.command == "clean":
        run_command(["bash", "-lc", "find . -type d -name __pycache__ -exec rm -rf {} +"], cwd=root)
        run_command(["bash", "-lc", "find . -type d -name .next -exec rm -rf {} +"], cwd=root)
        return 0
    if args.command == "db":
        server_dir = root / "server"
        python = server_dir / ".venv" / "bin" / "python"
        if not python.exists():
            print("Backend virtualenv missing. Please initialize server/.venv first.")
            return 1
        if args.db_cmd == "upgrade":
            return run_command([str(python), "-m", "alembic", "upgrade", "head"], cwd=server_dir)
        if args.db_cmd == "downgrade":
            return run_command([str(python), "-m", "alembic", "downgrade", args.revision], cwd=server_dir)
        if args.db_cmd == "revision":
            return run_command([str(python), "-m", "alembic", "revision", "--autogenerate", "-m", args.message], cwd=server_dir)
        if args.db_cmd == "seed":
            return run_command([str(python), "-m", "scripts.seed"], cwd=server_dir)
    raise ValueError(f"Unsupported devops command: {args.command}")


def handle_openclaw(args: argparse.Namespace, config: NeoCliConfig) -> int:
    root = project_root(config)
    if args.openclaw_cmd == "install-skill":
        return run_script(root, "infra/scripts/install-openclaw-skill.sh")
    if args.openclaw_cmd == "bootstrap":
        install_exit = run_script(root, "infra/scripts/install-openclaw-skill.sh")
        if install_exit != 0:
            return install_exit
        client = NeoApiClient(load_config())
        started = start_bootstrap_session(client, args.token_name, args.expires_in_days, args.client_name)
        if not started.ok:
            return result_exit(started)
        info = started.payload.get("data") or {}
        session_id = info.get("session_id")
        user_code = info.get("user_code")
        poll_seconds = int(info.get("poll_interval_seconds") or 3)
        if not session_id or not user_code:
            print_json({"code": 40002, "message": "Bootstrap session started but response is incomplete.", "data": info})
            return 1
        pid, log_path = spawn_bootstrap_waiter(
            load_config(),
            session_id=session_id,
            user_code=user_code,
            poll_seconds=poll_seconds,
        )
        print_json({
            "code": 0,
            "message": "OpenClaw bootstrap started on this host. Open the approval link in a browser; the host will continue automatically.",
            "data": {
                **info,
                "skill_installed": True,
                "waiter_started": True,
                "waiter_pid": pid,
                "waiter_log_path": str(log_path),
                "next_step_for_user": "Open verification_uri_complete in any browser and approve the request.",
            },
        })
        return 0
    raise ValueError(f"Unsupported openclaw command: {args.openclaw_cmd}")


def handle_api(args: argparse.Namespace, client: NeoApiClient) -> int:
    if args.auth:
        ensure_auth(client)
    data = parse_json_arg(args.data)
    params = parse_json_arg(args.params)
    result = client.request(args.method, args.path, auth=args.auth, data=data, params=params)
    return result_exit(result)


def handle_resource(args: argparse.Namespace, client: NeoApiClient) -> int:
    resource = args.resource
    action = args.action
    base = f"/{resource}"

    if action == "list":
        params = parse_json_arg(args.params, {}) or {}
        result = client.request("GET", base, auth=args.auth, params=params)
        return result_exit(result)
    if action == "get":
        result = client.request("GET", f"{base}/{args.identifier}", auth=args.auth)
        return result_exit(result)
    if action == "create":
        ensure_auth(client)
        result = client.request("POST", base, auth=True, data=build_resource_payload(args, "create"))
        return result_exit(result)
    if action == "update":
        ensure_auth(client)
        method = "PATCH" if getattr(args, "patch", False) else "PUT"
        result = client.request(method, f"{base}/{args.identifier}", auth=True, data=build_resource_payload(args, "update"))
        return result_exit(result)
    if action == "delete":
        ensure_auth(client)
        result = client.request("DELETE", f"{base}/{args.identifier}", auth=True)
        return result_exit(result)
    if resource == "posts" and action == "import-url":
        ensure_auth(client)
        result = client.request("POST", "/posts/import/url", auth=True, data={"url": args.url})
        return result_exit(result)
    if resource == "posts" and action == "import-file":
        ensure_auth(client)
        result = client.upload_file("/posts/import/file", args.file, auth=True)
        return result_exit(result)
    if resource == "uploads" and action == "upload":
        ensure_auth(client)
        result = client.upload_file("/uploads", args.file, auth=True)
        return result_exit(result)
    raise ValueError(f"Unsupported {resource} action: {action}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="neo", description="NEO CLI: manage local services and site operations.")
    sub = parser.add_subparsers(dest="command", required=True)

    auth = sub.add_parser("auth", help="CLI authentication")
    auth_sub = auth.add_subparsers(dest="auth_cmd", required=True)
    auth_login = auth_sub.add_parser("login", help="Save admin JWT token")
    auth_login.add_argument("--token", required=True)
    auth_sub.add_parser("logout", help="Remove local token")
    auth_sub.add_parser("whoami", help="Check current token")
    auth_sub.add_parser("status", help="Show whether CLI authentication is ready")
    auth_sub.add_parser("guide", help="Show authentication instructions")
    auth_bootstrap = auth_sub.add_parser("bootstrap", help="Start browser-approved bootstrap auth for remote CLI/OpenClaw")
    auth_bootstrap.add_argument("--token-name", default="openclaw-operator")
    auth_bootstrap.add_argument("--expires-in-days", type=int, default=30)
    auth_bootstrap.add_argument("--client-name", default="remote-openclaw")
    auth_bootstrap.add_argument("--no-wait", action="store_true")
    auth_bootstrap.add_argument("--detach", action="store_true", help="Return the approval link immediately and keep waiting in the background")
    auth_bootstrap_wait = auth_sub.add_parser("bootstrap-wait", help="Internal background waiter for bootstrap auth")
    auth_bootstrap_wait.add_argument("--session-id", required=True)
    auth_bootstrap_wait.add_argument("--user-code", required=True)
    auth_bootstrap_wait.add_argument("--poll-seconds", type=int, default=3)
    auth_sub.add_parser("github-url", help="Get GitHub login URL")
    auth_sub.add_parser("token-list", help="List CLI personal access tokens")
    auth_token_create = auth_sub.add_parser("token-create", help="Create CLI personal access token")
    auth_token_create.add_argument("--name", required=True)
    auth_token_create.add_argument("--expires-in-days", type=int, default=30)
    auth_token_revoke = auth_sub.add_parser("token-revoke", help="Revoke CLI personal access token")
    auth_token_revoke.add_argument("--token-id", type=int)
    auth_token_revoke.add_argument("--token-prefix")

    config = sub.add_parser("config", help="CLI configuration")
    config_sub = config.add_subparsers(dest="config_cmd", required=True)
    config_sub.add_parser("show", help="Show config")
    config_set = config_sub.add_parser("set", help="Update config value")
    config_set.add_argument("key")
    config_set.add_argument("value")

    system = sub.add_parser("system", help="Local service lifecycle")
    system_sub = system.add_subparsers(dest="system_cmd", required=True)
    system_sub.add_parser("start", help="Start local services")
    system_sub.add_parser("stop", help="Stop local services")
    system_sub.add_parser("restart", help="Restart local services")
    system_sub.add_parser("health", help="Check backend health")
    system_sub.add_parser("status", help="Show current service status")
    system_logs = system_sub.add_parser("logs", help="Show recent logs")
    system_logs.add_argument("service", choices=["server", "web"])
    system_logs.add_argument("--lines", type=int, default=40)

    install = sub.add_parser("install", help="Install local dependencies")
    install.set_defaults(command="install")

    clean = sub.add_parser("clean", help="Clean local build artifacts")
    clean.set_defaults(command="clean")

    openclaw = sub.add_parser("openclaw", help="OpenClaw integration helpers")
    openclaw_sub = openclaw.add_subparsers(dest="openclaw_cmd", required=True)
    openclaw_sub.add_parser("install-skill", help="Install neo-site-manager into the local OpenClaw workspace")
    openclaw_bootstrap = openclaw_sub.add_parser("bootstrap", help="Install skill and start remote-safe browser-approved auth on this host")
    openclaw_bootstrap.add_argument("--token-name", default="openclaw-operator")
    openclaw_bootstrap.add_argument("--expires-in-days", type=int, default=30)
    openclaw_bootstrap.add_argument("--client-name", default="openclaw-ecs")

    db = sub.add_parser("db", help="Database operations")
    db.set_defaults(command="db")
    db_sub = db.add_subparsers(dest="db_cmd", required=True)
    db_sub.add_parser("upgrade", help="Apply migrations")
    db_down = db_sub.add_parser("downgrade", help="Rollback to revision")
    db_down.add_argument("revision", nargs="?", default="-1")
    db_rev = db_sub.add_parser("revision", help="Create migration")
    db_rev.add_argument("-m", "--message", default="auto")
    db_sub.add_parser("seed", help="Seed sample data")

    api = sub.add_parser("api", help="Generic API request")
    api_sub = api.add_subparsers(dest="api_cmd", required=True)
    api_request = api_sub.add_parser("request", help="Call any API path")
    api_request.add_argument("method")
    api_request.add_argument("path")
    api_request.add_argument("--data")
    api_request.add_argument("--params")
    api_request.add_argument("--auth", action="store_true")

    for resource in ("projects", "skills", "posts", "guestbook"):
        rp = sub.add_parser(resource, help=f"{resource} resource commands")
        rp.set_defaults(resource=resource)
        rs = rp.add_subparsers(dest="action", required=True)
        rlist = rs.add_parser("list")
        rlist.add_argument("--params")
        rlist.add_argument("--auth", action="store_true")
        rget = rs.add_parser("get")
        rget.add_argument("identifier")
        rget.add_argument("--auth", action="store_true")
        rcreate = rs.add_parser("create")
        rcreate.add_argument("--data")
        rupdate = rs.add_parser("update")
        rupdate.add_argument("identifier")
        rupdate.add_argument("--data")
        rupdate.add_argument("--patch", action="store_true")
        rdelete = rs.add_parser("delete")
        rdelete.add_argument("identifier")
        if resource == "projects":
            for parser_obj in (rcreate, rupdate):
                parser_obj.add_argument("--title")
                parser_obj.add_argument("--description")
                parser_obj.add_argument("--category")
                parser_obj.add_argument("--tech-stack")
                parser_obj.add_argument("--cover-url")
                parser_obj.add_argument("--demo-url")
                parser_obj.add_argument("--repo-url")
                parser_obj.add_argument("--hf-url")
                parser_obj.add_argument("--status")
                parser_obj.add_argument("--sort-order", type=int)
                parser_obj.add_argument("--featured", action="store_true")
                parser_obj.add_argument("--not-featured", action="store_true")
            rcreate.add_argument("--slug", required=True)
        if resource == "skills":
            for parser_obj in (rcreate, rupdate):
                parser_obj.add_argument("--name")
                parser_obj.add_argument("--description")
                parser_obj.add_argument("--category")
                parser_obj.add_argument("--version")
                parser_obj.add_argument("--platform")
                parser_obj.add_argument("--source-url")
                parser_obj.add_argument("--install-command")
                parser_obj.add_argument("--status")
            rcreate.add_argument("--slug", required=True)
        if resource == "posts":
            for parser_obj in (rcreate, rupdate):
                parser_obj.add_argument("--title")
                parser_obj.add_argument("--summary")
                parser_obj.add_argument("--content")
                parser_obj.add_argument("--tags")
                parser_obj.add_argument("--cover-url")
                parser_obj.add_argument("--published", action="store_true")
                parser_obj.add_argument("--draft", action="store_true")
            rcreate.add_argument("--slug", required=True)
        if resource == "posts":
            rimport_url = rs.add_parser("import-url")
            rimport_url.add_argument("url")
            rimport_file = rs.add_parser("import-file")
            rimport_file.add_argument("file")
        if resource == "guestbook":
            for parser_obj in (rcreate, rupdate):
                parser_obj.add_argument("--nickname")
                parser_obj.add_argument("--message")

    posts_import_url = sub.add_parser("posts-import-url", help="Import post from URL")
    posts_import_url.set_defaults(resource="posts", action="import-url")
    posts_import_url.add_argument("url")

    posts_import_file = sub.add_parser("posts-import-file", help="Import post from file")
    posts_import_file.set_defaults(resource="posts", action="import-file")
    posts_import_file.add_argument("file")

    uploads = sub.add_parser("upload", help="Upload media")
    uploads.set_defaults(resource="uploads", action="upload")
    uploads.add_argument("file")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    config = load_config()
    client = NeoApiClient(config)

    try:
        if args.command == "auth":
            return handle_auth(args, config, client)
        if args.command == "config":
            return handle_config(args, config)
        if args.command == "system":
            return handle_system(args, config, client)
        if args.command in {"install", "clean", "db"}:
            return handle_devops(args, config)
        if args.command == "openclaw":
            return handle_openclaw(args, config)
        if args.command == "api":
            return handle_api(args, client)
        if args.command in {"projects", "skills", "posts", "guestbook"} or getattr(args, "resource", None):
            return handle_resource(args, client)
    except AuthRequiredError as exc:
        print_json(exc.payload)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"code": -1, "message": str(exc), "data": None}, ensure_ascii=False))
        return 1

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
