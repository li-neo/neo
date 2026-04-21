#!/usr/bin/env bash
# ============================================================
#  Neo — 本地手动触发 ECS 部署 (GitHub Actions 的备用方案)
#  用法: bash infra/scripts/deploy.sh
#        DEPLOY_HOST=1.2.3.4 bash infra/scripts/deploy.sh
#  环境变量从 .env 或环境中读取
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 从 .env 加载变量 (如果存在)
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
fi

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST in .env or environment}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_KEY="${DEPLOY_KEY_PATH:-$HOME/.ssh/id_rsa}"
REMOTE_DIR="${REMOTE_PROJECT_DIR:-/opt/neo}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Neo — 手动 SSH 部署                                     ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  目标: ${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}"
echo "║  密钥: ${DEPLOY_KEY}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

read -rp "确认部署? (y/N) " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

echo "==> 开始部署..."

ssh -i "$DEPLOY_KEY" -o StrictHostKeyChecking=accept-new \
    "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "cd ${REMOTE_DIR} && bash infra/scripts/auto-deploy.sh"

echo ""
echo "==> 部署完成!"
