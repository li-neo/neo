#!/usr/bin/env bash
set -euo pipefail

# Install neo-site-manager into OpenClaw workspace / 安装 neo-site-manager 到 OpenClaw workspace。

SOURCE_PATH="${BASH_SOURCE[0]}"
while [[ -L "$SOURCE_PATH" ]]; do
  LINK_DIR="$(cd "$(dirname "$SOURCE_PATH")" && pwd)"
  SOURCE_PATH="$(readlink "$SOURCE_PATH")"
  [[ "$SOURCE_PATH" != /* ]] && SOURCE_PATH="$LINK_DIR/$SOURCE_PATH"
done

ROOT_DIR="$(cd "$(dirname "$SOURCE_PATH")/../.." && pwd)"
SRC_DIR="$ROOT_DIR/.trae/skills/neo-site-manager"
DST_DIR="$HOME/.openclaw/workspace/skills/neo-site-manager"

mkdir -p "$DST_DIR"
cp "$SRC_DIR/SKILL.md" "$DST_DIR/SKILL.md"

echo "Installed neo-site-manager to: $DST_DIR"
echo "Next steps:"
echo "  1. openclaw skills list --json | grep neo-site-manager"
echo "  2. neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator"
