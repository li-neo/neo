#!/usr/bin/env bash
set -euo pipefail

# Install neo CLI on a fresh remote host / 在全新远端宿主机安装 neo CLI。
# This script is intended for cloud OpenClaw / ECS hosts that only have shell access.

GIT_REPO_URL="${GIT_REPO_URL:-https://github.com/li-neo/neo.git}"
NEO_CLI_HOME="${NEO_CLI_HOME:-$HOME/.local/share/neo}"
NEO_CLI_BIN_DIR="${NEO_CLI_BIN_DIR:-$HOME/.local/bin}"
export NEO_CLI_BIN_DIR
export NEO_CLI_VENV_DIR="${NEO_CLI_VENV_DIR:-$NEO_CLI_HOME/.venv-cli}"
CLI_PATH="$NEO_CLI_HOME/neo"
CLI_VENV_PYTHON="$NEO_CLI_VENV_DIR/bin/python"
TARGET_PATH="$NEO_CLI_BIN_DIR/neo"

mkdir -p "$(dirname "$NEO_CLI_HOME")" "$NEO_CLI_BIN_DIR"

if [[ "$GIT_REPO_URL" == file://* ]]; then
  SOURCE_DIR="${GIT_REPO_URL#file://}"
  rm -rf "$NEO_CLI_HOME"
  mkdir -p "$NEO_CLI_HOME"
  (cd "$SOURCE_DIR" && tar cf - --exclude .git .) | (cd "$NEO_CLI_HOME" && tar xf -)
elif [[ -d "$NEO_CLI_HOME/.git" ]]; then
  git -C "$NEO_CLI_HOME" pull --ff-only origin main
else
  rm -rf "$NEO_CLI_HOME"
  git clone "$GIT_REPO_URL" "$NEO_CLI_HOME"
fi

if [[ ! -f "$CLI_PATH" ]]; then
  echo "neo entrypoint not found after cloning repository: $CLI_PATH"
  exit 1
fi

if [[ ! -x "$CLI_VENV_PYTHON" ]]; then
  python3 -m venv "$NEO_CLI_VENV_DIR"
fi

"$CLI_VENV_PYTHON" -m pip install -U pip >/dev/null
"$CLI_VENV_PYTHON" -m pip install httpx >/dev/null

ln -sfn "$CLI_PATH" "$TARGET_PATH"
chmod +x "$CLI_PATH"

echo
echo "Remote install completed."
echo "Installed neo to: $TARGET_PATH"
echo "Resolved CLI target: $CLI_PATH"
echo "CLI runtime venv: $NEO_CLI_VENV_DIR"
echo "If '$NEO_CLI_BIN_DIR' is not already in PATH, add:"
echo "  export PATH=\"$NEO_CLI_BIN_DIR:\$PATH\""
echo
echo "Next recommended step:"
echo "  neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator"
