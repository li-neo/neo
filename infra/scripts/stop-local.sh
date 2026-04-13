#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_DIR="$ROOT_DIR/.pids"

stop_pid_file() {
  local name="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      echo "Stopping $name (pid=$pid)"
      kill "$pid" || true
    fi
    rm -f "$file"
  fi
}

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping processes on port $port: $pids"
    kill $pids || true
  fi
}

# Stop by pid first / 优先按 pid 文件停止，避免误伤无关进程。
stop_pid_file "frontend" "$PID_DIR/web.pid"
stop_pid_file "backend" "$PID_DIR/server.pid"

# Fallback on ports / 兜底按端口清理，避免 reload 父子进程残留。
stop_port 3000
stop_port 8000

echo "Local services stopped."
