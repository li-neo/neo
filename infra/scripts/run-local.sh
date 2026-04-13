#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
SERVER_DIR="$ROOT_DIR/server"
PID_DIR="$ROOT_DIR/.pids"
BACKEND_URL="http://127.0.0.1:8000/health"
FRONTEND_URL="http://127.0.0.1:3000/"
BLOG_URL="http://127.0.0.1:3000/blog"

mkdir -p "$PID_DIR"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
}

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping processes on port $port: $pids"
    kill $pids || true
    sleep 1
  fi
}

wait_http() {
  local url="$1"
  local name="$2"
  local retries="${3:-30}"

  for ((i=1; i<=retries; i++)); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      echo "$name is ready: $url"
      return 0
    fi
    sleep 1
  done

  echo "$name failed to become ready: $url"
  return 1
}

show_recent_logs() {
  echo
  echo "Recent backend log:"
  tail -n 30 "$PID_DIR/server.log" 2>/dev/null || true
  echo
  echo "Recent frontend log:"
  tail -n 30 "$PID_DIR/web-start.log" 2>/dev/null || true
}

require_cmd curl
require_cmd lsof
require_cmd pnpm

echo "[1/5] Cleaning previous local services"
# Stable local startup / 稳定本地启动：避免旧 dev server 和新进程互相打架。
kill_port 3000
kill_port 8000
rm -f "$PID_DIR/server.pid" "$PID_DIR/web.pid"

echo "[2/5] Checking backend runtime"
if [[ ! -x "$SERVER_DIR/.venv/bin/uvicorn" ]]; then
  echo "Backend runtime missing: $SERVER_DIR/.venv/bin/uvicorn"
  echo "Please create or repair the server virtualenv first."
  exit 1
fi

echo "[3/5] Starting backend with scoped reload"
# Reload only app sources / 仅监听 app 目录，避免 .venv 变动触发重载风暴。
(
  cd "$SERVER_DIR"
  nohup ./.venv/bin/uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000 \
    > "$PID_DIR/server.log" 2>&1 &
  echo $! > "$PID_DIR/server.pid"
)
wait_http "$BACKEND_URL" "Backend" || {
  show_recent_logs
  exit 1
}

echo "[4/5] Building frontend"
(
  cd "$WEB_DIR"
  rm -rf .next
  pnpm build
)

echo "[5/5] Starting frontend in stable mode"
# Use production preview / 使用 build + start，绕过 next dev 的本地开发态不稳定问题。
(
  cd "$WEB_DIR"
  nohup pnpm start > "$PID_DIR/web-start.log" 2>&1 &
  echo $! > "$PID_DIR/web.pid"
)
wait_http "$FRONTEND_URL" "Frontend" || {
  show_recent_logs
  exit 1
}
wait_http "$BLOG_URL" "Blog page" || {
  show_recent_logs
  exit 1
}

echo
echo "Local services are ready:"
echo "- Frontend: http://127.0.0.1:3000"
echo "- Backend : http://127.0.0.1:8000"
echo
echo "Logs:"
echo "- $PID_DIR/web-start.log"
echo "- $PID_DIR/server.log"
