#!/usr/bin/env bash
set -euo pipefail

# Install global `neo` command / 安装全局 `neo` 命令
# Prefer a writable bin directory already on PATH / 优先选择当前 PATH 中可写的目录。

SOURCE_PATH="${BASH_SOURCE[0]}"
while [[ -L "$SOURCE_PATH" ]]; do
  LINK_DIR="$(cd "$(dirname "$SOURCE_PATH")" && pwd)"
  SOURCE_PATH="$(readlink "$SOURCE_PATH")"
  [[ "$SOURCE_PATH" != /* ]] && SOURCE_PATH="$LINK_DIR/$SOURCE_PATH"
done
ROOT_DIR="$(cd "$(dirname "$SOURCE_PATH")/../.." && pwd)"
CLI_PATH="$ROOT_DIR/neo"
CLI_VENV_DIR="${NEO_CLI_VENV_DIR:-$ROOT_DIR/.venv-cli}"
CLI_VENV_PYTHON="$CLI_VENV_DIR/bin/python"
TARGET_DIR="${NEO_CLI_BIN_DIR:-}"

pick_target_dir() {
  local candidate
  for candidate in /opt/homebrew/bin /usr/local/bin "$HOME/.local/bin" "$HOME/.npm-global/bin"; do
    [[ -d "$candidate" ]] || mkdir -p "$candidate" 2>/dev/null || true
    if [[ -d "$candidate" && -w "$candidate" ]]; then
      case ":$PATH:" in
        *":$candidate:"*)
          echo "$candidate"
          return 0
          ;;
      esac
    fi
  done

  for candidate in /opt/homebrew/bin /usr/local/bin "$HOME/.local/bin" "$HOME/.npm-global/bin"; do
    [[ -d "$candidate" ]] || mkdir -p "$candidate" 2>/dev/null || true
    if [[ -d "$candidate" && -w "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

if [[ -z "$TARGET_DIR" ]]; then
  TARGET_DIR="$(pick_target_dir)"
fi
if [[ -z "${TARGET_DIR:-}" ]]; then
  echo "No writable bin directory found for installing neo."
  exit 1
fi

TARGET_PATH="$TARGET_DIR/neo"

if [[ ! -x "$CLI_VENV_PYTHON" ]]; then
  python3 -m venv "$CLI_VENV_DIR"
fi

"$CLI_VENV_PYTHON" -m pip install -U pip >/dev/null
"$CLI_VENV_PYTHON" -m pip install httpx >/dev/null

ln -sfn "$CLI_PATH" "$TARGET_PATH"
chmod +x "$CLI_PATH"

echo "Installed neo to: $TARGET_PATH"
echo "Resolved CLI target: $CLI_PATH"
echo "CLI runtime venv: $CLI_VENV_DIR"
echo
echo "Verify with:"
echo "  command -v neo"
echo "  neo --help"
