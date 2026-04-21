#!/usr/bin/env bash
# ============================================================
#  Neo — ECS 自动部署脚本
#  由 GitHub Actions 或 deploy.sh 通过 SSH 调用
#  功能: git pull → 安装依赖 → 构建前端 → 数据库迁移 → 重启服务 → 健康检查
#  回滚: 部署失败自动回退到上一个 commit
# ============================================================
set -euo pipefail

PROJECT_DIR="${NEO_PROJECT_DIR:-/opt/neo}"
ENV_FILE="${PROJECT_DIR}/.env"
LOG_FILE="/tmp/neo-deploy-$(date +%Y%m%d-%H%M%S).log"

HEALTH_URL="http://127.0.0.1:8000/health"
HEALTH_RETRIES=10
HEALTH_INTERVAL=3

info()  { echo -e "\033[1;34m>>> $*\033[0m" | tee -a "$LOG_FILE"; }
ok()    { echo -e "\033[1;32m  ✔ $*\033[0m" | tee -a "$LOG_FILE"; }
err()   { echo -e "\033[1;31m  ✖ $*\033[0m" | tee -a "$LOG_FILE"; }

cleanup_on_failure() {
    local exit_code=$?
    if [ $exit_code -ne 0 ] && [ -n "${PREV_REV:-}" ]; then
        err "部署失败 (exit=$exit_code)，回滚到 $PREV_REV"
        cd "$PROJECT_DIR"
        git checkout "$PREV_REV" --force 2>&1 | tee -a "$LOG_FILE"
        systemctl restart neo-server neo-web 2>&1 | tee -a "$LOG_FILE" || true
        err "已回滚。完整日志: $LOG_FILE"
    fi
}
trap cleanup_on_failure EXIT

cd "$PROJECT_DIR"

# ---------- 1. 记录当前版本 (用于回滚) ----------
PREV_REV=$(git rev-parse HEAD)
info "当前版本: $PREV_REV"

# ---------- 2. 拉取最新代码 ----------
info "拉取最新代码"
git fetch origin main 2>&1 | tee -a "$LOG_FILE"
git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"
NEW_REV=$(git rev-parse HEAD)
ok "已更新到: $NEW_REV"

if [ "$PREV_REV" = "$NEW_REV" ]; then
    ok "代码未变化，跳过构建"
    # Still restart in case the deploy was triggered manually for config changes
fi

# ---------- 3. 后端依赖 ----------
info "安装后端依赖"
cd "$PROJECT_DIR/server"
if command -v uv &>/dev/null; then
    uv sync 2>&1 | tee -a "$LOG_FILE"
else
    .venv/bin/pip install -r pyproject.toml 2>&1 | tee -a "$LOG_FILE"
fi
ok "后端依赖就绪"

# ---------- 4. 前端构建 ----------
info "安装前端依赖 & 构建"
cd "$PROJECT_DIR/apps/web"

# 从 .env 读取 NEXT_PUBLIC 变量
NEXT_PUBLIC_API_URL="http://127.0.0.1:8000"
NEXT_PUBLIC_SITE_URL=""
if [ -f "$ENV_FILE" ]; then
    NEXT_PUBLIC_API_URL=$(grep -E '^NEXT_PUBLIC_API_URL=' "$ENV_FILE" | tail -1 | cut -d'=' -f2- || echo "http://127.0.0.1:8000")
    NEXT_PUBLIC_SITE_URL=$(grep -E '^NEXT_PUBLIC_SITE_URL=' "$ENV_FILE" | tail -1 | cut -d'=' -f2- || echo "")
fi

pnpm install --frozen-lockfile 2>&1 | tee -a "$LOG_FILE"
NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" INTERNAL_API_URL="http://127.0.0.1:8000" pnpm build 2>&1 | tee -a "$LOG_FILE"

# standalone 模式需要复制 static 和 public 资源
if [ -d ".next/standalone" ]; then
    cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
    cp -r public .next/standalone/public 2>/dev/null || true
fi
ok "前端构建完成"

# ---------- 5. 数据库迁移 ----------
info "执行数据库迁移"
cd "$PROJECT_DIR/server"
VENV_PYTHON="${PROJECT_DIR}/server/.venv/bin/python"
"$VENV_PYTHON" -m alembic upgrade head 2>&1 | tee -a "$LOG_FILE"
ok "数据库迁移完成"

# ---------- 6. 重启服务 ----------
info "重启 systemd 服务"
systemctl daemon-reload
systemctl restart neo-server 2>&1 | tee -a "$LOG_FILE"
sleep 2
systemctl restart neo-web 2>&1 | tee -a "$LOG_FILE"
ok "服务已重启"

# ---------- 7. 健康检查 ----------
info "健康检查 ($HEALTH_URL)"
HEALTHY=false
for i in $(seq 1 "$HEALTH_RETRIES"); do
    sleep "$HEALTH_INTERVAL"
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTHY=true
        break
    fi
    echo "  尝试 $i/$HEALTH_RETRIES — HTTP $HTTP_CODE" | tee -a "$LOG_FILE"
done

if [ "$HEALTHY" = true ]; then
    ok "健康检查通过"
else
    err "健康检查失败，服务可能未正常启动"
    journalctl -u neo-server -n 20 --no-pager 2>&1 | tee -a "$LOG_FILE"
    journalctl -u neo-web -n 20 --no-pager 2>&1 | tee -a "$LOG_FILE"
    exit 1
fi

# ---------- 8. 输出结果 ----------
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ 部署成功!                                           ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  版本: ${NEW_REV:0:12}                                  ║"
echo "║  日志: $LOG_FILE                                        ║"
echo "╚══════════════════════════════════════════════════════════╝"

for svc in neo-server neo-web nginx; do
    if systemctl is-active "$svc" &>/dev/null; then
        echo "  🟢 $svc"
    else
        echo "  🔴 $svc"
    fi
done
