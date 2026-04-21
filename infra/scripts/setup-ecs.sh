#!/usr/bin/env bash
# ============================================================
#  Neo 项目 — 火山引擎 ECS 裸机部署（无 Docker）
#  系统: CentOS Stream 9
#  用法: bash setup-ecs.sh
# ============================================================
set -euo pipefail

PROJECT_DIR=/opt/neo
SERVER_IP="101.96.207.11"
ENV_FILE="${PROJECT_DIR}/.env"

# ---------- Mirrors / Sources ----------
# 中文: 统一收口外部源，便于在国内 ECS 环境快速切换镜像。
# EN: Centralize external sources so they can be switched easily in mainland ECS.
GIT_REPO_URL="${GIT_REPO_URL:-https://github.com/li-neo/neo.git}"
PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
NODESOURCE_SETUP_URL="${NODESOURCE_SETUP_URL:-https://rpm.nodesource.com/setup_22.x}"
VENV_DIR="${VENV_DIR:-${PROJECT_DIR}/server/.venv}"

# ---------- Site / Auth ----------
# 中文: 生产环境域名、公开 API 地址、GitHub OAuth 参数统一从环境变量注入。
# EN: Production domains, public API base URL and GitHub OAuth settings are injected via env vars.
PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-li-neo.top}"
WWW_DOMAIN="${WWW_DOMAIN:-www.li-neo.top}"
SITE_SCHEME="${SITE_SCHEME:-https}"
SITE_URL="${SITE_URL:-${SITE_SCHEME}://${PRIMARY_DOMAIN}}"
SITE_URL_WWW="${SITE_URL_WWW:-${SITE_SCHEME}://${WWW_DOMAIN}}"
PUBLIC_API_BASE_URL="${PUBLIC_API_BASE_URL:-${SITE_URL}}"
ADMIN_GITHUB_USERS="${ADMIN_GITHUB_USERS:-2995183552@qq.com}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}"
GITHUB_REDIRECT_URI="${GITHUB_REDIRECT_URI:-${SITE_URL}/api/v1/auth/github/callback}"

info()  { echo -e "\n\033[1;34m>>> $*\033[0m"; }
ok()    { echo -e "\033[1;32m  ✔ $*\033[0m"; }
warn()  { echo -e "\033[1;33m  ⚠ $*\033[0m"; }

read_env_value() {
    local key="$1"
    local default_value="${2:-}"

    if [ -f "$ENV_FILE" ]; then
        local line
        line=$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)
        if [ -n "$line" ]; then
            printf '%s' "${line#*=}"
            return
        fi
    fi

    printf '%s' "$default_value"
}

if [ -f "$ENV_FILE" ]; then
    EXISTING_SITE_URL="$(read_env_value NEXT_PUBLIC_SITE_URL "")"
    EXISTING_API_URL="$(read_env_value NEXT_PUBLIC_API_URL "")"
    EXISTING_GITHUB_CLIENT_ID="$(read_env_value GITHUB_CLIENT_ID "")"
    EXISTING_GITHUB_CLIENT_SECRET="$(read_env_value GITHUB_CLIENT_SECRET "")"
    EXISTING_GITHUB_REDIRECT_URI="$(read_env_value GITHUB_REDIRECT_URI "")"
    EXISTING_ADMIN_GITHUB_USERS="$(read_env_value ADMIN_GITHUB_USERS "")"

    if [ -n "$EXISTING_SITE_URL" ]; then
        SITE_URL="$EXISTING_SITE_URL"
        SITE_SCHEME="$(printf '%s' "$SITE_URL" | sed -E 's,^(https?)://.*,\1,')"
        PRIMARY_DOMAIN="$(printf '%s' "$SITE_URL" | sed -E 's,^https?://([^/:]+).*,\1,')"
        WWW_DOMAIN="www.${PRIMARY_DOMAIN#www.}"
        SITE_URL_WWW="${SITE_SCHEME}://${WWW_DOMAIN}"
    fi

    [ -n "$EXISTING_API_URL" ] && PUBLIC_API_BASE_URL="$EXISTING_API_URL"
    [ -n "$EXISTING_GITHUB_CLIENT_ID" ] && GITHUB_CLIENT_ID="$EXISTING_GITHUB_CLIENT_ID"
    [ -n "$EXISTING_GITHUB_CLIENT_SECRET" ] && GITHUB_CLIENT_SECRET="$EXISTING_GITHUB_CLIENT_SECRET"
    [ -n "$EXISTING_GITHUB_REDIRECT_URI" ] && GITHUB_REDIRECT_URI="$EXISTING_GITHUB_REDIRECT_URI"
    [ -n "$EXISTING_ADMIN_GITHUB_USERS" ] && ADMIN_GITHUB_USERS="$EXISTING_ADMIN_GITHUB_USERS"
fi

echo "╔═══════════════════════════════════════════╗"
echo "║   Neo 项目 — 裸机部署 (无 Docker)        ║"
echo "╚═══════════════════════════════════════════╝"

# ── 1. 系统更新 & 基础工具 ──
info "1/8 系统更新 & 安装基础工具"
dnf update -y -q
dnf install -y -q git curl wget vim tar gcc make openssl-devel bzip2-devel \
    libffi-devel zlib-devel readline-devel sqlite-devel
ok "基础工具就绪"

# ── 2. 安装 Python 3.12 ──
info "2/8 安装 Python 3.12"
if python3 --version 2>/dev/null | grep -q "3.1[2-9]"; then
    ok "Python 已存在: $(python3 --version)"
else
    dnf install -y python3.12 python3.12-pip python3.12-devel 2>/dev/null && {
        ln -sf /usr/bin/python3.12 /usr/bin/python3
        ok "Python 3.12 from dnf"
    } || {
        warn "dnf 无 python3.12, 从华为云源码编译..."
        cd /tmp
        curl -sLO https://mirrors.huaweicloud.com/python/3.12.8/Python-3.12.8.tgz
        tar xzf Python-3.12.8.tgz && cd Python-3.12.8
        ./configure --enable-optimizations --prefix=/usr/local >/dev/null 2>&1
        make -j"$(nproc)" >/dev/null 2>&1
        make altinstall >/dev/null 2>&1
        ln -sf /usr/local/bin/python3.12 /usr/local/bin/python3
        cd /tmp && rm -rf Python-3.12.8*
        ok "Python 3.12 compiled from source"
    }
fi

# ── 3. 检查 pip / venv ──
info "3/8 检查 pip / venv"
python3 -m pip --version >/dev/null 2>&1 || dnf install -y python3-pip
python3 -m venv --help >/dev/null 2>&1 || dnf install -y python3.12-pip
ok "pip 已就绪: $(python3 -m pip --version | awk '{print $1, $2}')"

# ── 4. 安装 Node.js 22 + pnpm ──
info "4/8 安装 Node.js 22 + pnpm"
if node --version 2>/dev/null | grep -q "v2[2-9]"; then
    ok "Node.js 已存在: $(node --version)"
else
    curl --retry 3 --retry-delay 2 --retry-all-errors -fsSL "$NODESOURCE_SETUP_URL" | bash - >/dev/null 2>&1
    dnf install -y -q nodejs
    ok "Node.js: $(node --version)"
fi
command -v pnpm &>/dev/null || npm install -g pnpm --registry "$NPM_REGISTRY" >/dev/null 2>&1
pnpm config set registry "$NPM_REGISTRY" >/dev/null 2>&1 || true
ok "pnpm: $(pnpm --version)"

# ── 5. 安装 MySQL 8 ──
info "5/8 安装 MySQL 8"
if systemctl is-active mysqld &>/dev/null; then
    ok "MySQL 已在运行"
else
    dnf install -y -q mysql-server
    systemctl enable --now mysqld
    ok "MySQL 已安装并启动"
fi

MYSQL_HOST="$(read_env_value MYSQL_HOST "localhost")"
MYSQL_PORT="$(read_env_value MYSQL_PORT "3306")"
MYSQL_USER="$(read_env_value MYSQL_USER "neo")"
MYSQL_DATABASE="$(read_env_value MYSQL_DATABASE "neo")"
MYSQL_PW="$(read_env_value MYSQL_PASSWORD "")"
if [ -z "$MYSQL_PW" ]; then
    MYSQL_PW=$(openssl rand -hex 16)
    warn "生成新 MySQL 密码（首次安装或 .env 缺失 MYSQL_PASSWORD）"
fi

if [ "$MYSQL_HOST" = "localhost" ] || [ "$MYSQL_HOST" = "127.0.0.1" ]; then
    # 只在用户不存在或密码确实需要设置时才 ALTER USER，避免误改密码
    if mysql -u "$MYSQL_USER" -p"$MYSQL_PW" -e "SELECT 1" "$MYSQL_DATABASE" &>/dev/null; then
        ok "数据库 ${MYSQL_DATABASE} 连接验证通过，跳过用户初始化"
    else
mysql -u root <<SQLEOF
CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PW}';
ALTER USER '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PW}';
GRANT ALL PRIVILEGES ON ${MYSQL_DATABASE}.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
SQLEOF
        ok "数据库 ${MYSQL_DATABASE} 初始化完成"
    fi
else
    warn "检测到 MYSQL_HOST=${MYSQL_HOST}，跳过本机 MySQL 用户初始化"
fi

# ── 6. 安装 Nginx ──
info "6/8 安装 Nginx"
if command -v nginx &>/dev/null; then
    ok "Nginx 已存在"
else
    dnf install -y -q nginx
    systemctl enable nginx
    ok "Nginx 已安装"
fi

# ── 7. 拉取代码 & 安装依赖 ──
info "7/8 拉取代码 & 安装依赖"
if [ -d "$PROJECT_DIR/.git" ]; then
    cd "$PROJECT_DIR" && git pull origin main
    ok "代码已更新"
else
    info "  → 拉取仓库: ${GIT_REPO_URL}"
    git clone "$GIT_REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    ok "代码已拉取"
fi

# 后端
info "  → 安装后端 Python 依赖"
cd "$PROJECT_DIR/server"
export PIP_DISABLE_PIP_VERSION_CHECK=1
info "     Python 镜像源: ${PIP_INDEX_URL}"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install -U pip setuptools wheel -i "$PIP_INDEX_URL" --default-timeout=120 2>&1 | tee /tmp/neo-pip-bootstrap.log
mapfile -t PY_DEPS < <("$VENV_DIR/bin/python" - <<'PY'
import tomllib
from pathlib import Path

data = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))
for dep in data.get("project", {}).get("dependencies", []):
    print(dep)
PY
)
"$VENV_DIR/bin/pip" install "${PY_DEPS[@]}" -i "$PIP_INDEX_URL" --default-timeout=120 2>&1 | tee /tmp/neo-pip-install.log
mkdir -p uploads
ok "后端依赖就绪"

# 前端
info "  → 安装前端依赖 & 构建"
cd "$PROJECT_DIR/apps/web"
info "     NPM / pnpm 镜像源: ${NPM_REGISTRY}"
pnpm install --frozen-lockfile 2>&1 | tee /tmp/neo-pnpm-install.log
NEXT_PUBLIC_API_URL="${PUBLIC_API_BASE_URL}" NEXT_PUBLIC_SITE_URL="${SITE_URL}" pnpm build 2>&1 | tee /tmp/neo-pnpm-build.log
ok "前端构建完成"

# ── 8. 生成配置 & systemd 服务 ──
info "8/8 配置文件 & 服务"

SECRET_KEY="$(read_env_value SECRET_KEY "")"
JWT_SECRET="$(read_env_value JWT_SECRET_KEY "")"
[ -n "$SECRET_KEY" ] || SECRET_KEY=$(openssl rand -hex 32)
[ -n "$JWT_SECRET" ] || JWT_SECRET=$(openssl rand -hex 32)

# — .env —
if [ -f "$ENV_FILE" ]; then
    ok ".env 已存在，保留现有配置"
else
cat > "$ENV_FILE" << ENVEOF
APP_NAME=neo
APP_ENV=production
DEBUG=false
SECRET_KEY=${SECRET_KEY}

MYSQL_HOST=${MYSQL_HOST}
MYSQL_PORT=${MYSQL_PORT}
MYSQL_USER=${MYSQL_USER}
MYSQL_PASSWORD=${MYSQL_PW}
MYSQL_DATABASE=${MYSQL_DATABASE}

API_HOST=0.0.0.0
API_PORT=8000
API_PREFIX=/api/v1
CORS_ORIGINS=["${SITE_URL}","${SITE_URL_WWW}","http://${SERVER_IP}"]

NEXT_PUBLIC_API_URL=${PUBLIC_API_BASE_URL}
NEXT_PUBLIC_SITE_URL=${SITE_URL}

GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
GITHUB_REDIRECT_URI=${GITHUB_REDIRECT_URI}

ADMIN_GITHUB_USERS=${ADMIN_GITHUB_USERS}

JWT_SECRET_KEY=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

UPLOAD_DIR=uploads
MAX_UPLOAD_MB=50

OPENCLAW_API_URL=
OPENCLAW_API_KEY=
OPENCLAW_MODEL=openclaw/neo-web
MCP_ENABLED=false
CHAT_SYSTEM_PROMPT=
ENVEOF
ok ".env 已生成（密钥自动随机）"
fi

# — Nginx —
rm -f /etc/nginx/conf.d/default.conf
if [ -f /etc/nginx/conf.d/neo.conf ] && grep -q "ssl_certificate" /etc/nginx/conf.d/neo.conf 2>/dev/null; then
    ok "Nginx 配置已含 SSL（certbot），跳过覆盖"
else
cat > /etc/nginx/conf.d/neo.conf <<NGEOF
upstream neo_web { server 127.0.0.1:3000; }
upstream neo_api { server 127.0.0.1:8000; }

limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/s;

server {
    listen 80;
    server_name ${PRIMARY_DOMAIN} ${WWW_DOMAIN} _;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://neo_api;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 180s;
        proxy_buffering off;
        proxy_cache off;
    }

    location /uploads/ {
        alias /opt/neo/server/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://neo_web;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGEOF
ok "Nginx 配置就绪"
fi

# — systemd: neo-server —
cat > /etc/systemd/system/neo-server.service << SVCEOF
[Unit]
Description=Neo Backend (FastAPI)
After=network.target mysqld.service
Wants=mysqld.service

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}/server
EnvironmentFile=${PROJECT_DIR}/.env
ExecStart=${VENV_DIR}/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

# — systemd: neo-web —
NODE_BIN=$(which node)
cat > /etc/systemd/system/neo-web.service << SVCEOF
[Unit]
Description=Neo Frontend (Next.js)
After=network.target neo-server.service

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}/apps/web
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=${NODE_BIN} .next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF
ok "systemd 服务文件就绪"

# — 防火墙 —
systemctl enable --now firewalld 2>/dev/null || true
firewall-cmd --permanent --add-service=http  2>/dev/null || true
firewall-cmd --permanent --add-service=https 2>/dev/null || true
firewall-cmd --permanent --add-port=22/tcp   2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true
ok "防火墙配置就绪"

# — 数据库迁移 —
info "执行数据库迁移"
cd "$PROJECT_DIR/server"
"$VENV_DIR/bin/python" -m alembic upgrade head 2>&1 | tee /tmp/neo-db-upgrade.log
ok "数据库迁移完成"

# — 启动全部服务 —
info "启动所有服务"
systemctl daemon-reload
systemctl enable neo-server neo-web nginx
systemctl restart mysqld
systemctl restart neo-server
sleep 3
systemctl restart neo-web
sleep 2
nginx -t
systemctl restart nginx

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ 部署完成!                                          ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
STATUS=""
for svc in mysqld neo-server neo-web nginx; do
    if systemctl is-active "$svc" &>/dev/null; then
        STATUS="${STATUS}    🟢 ${svc}\n"
    else
        STATUS="${STATUS}    🔴 ${svc}  → journalctl -u ${svc} -n 30\n"
    fi
done
echo -e "║  服务状态:\n${STATUS}║"
echo "║  常用命令:                                               ║"
echo "║    systemctl status  neo-server     # 查看后端状态       ║"
echo "║    systemctl restart neo-server     # 重启后端           ║"
echo "║    systemctl restart neo-web        # 重启前端           ║"
echo "║    journalctl -u neo-server -f      # 后端实时日志       ║"
echo "║    journalctl -u neo-web -f         # 前端实时日志       ║"
echo "║                                                          ║"
echo "║  MySQL 密码: ${MYSQL_PW}"
echo "║  密钥文件:   /opt/neo/.env                               ║"
echo "║                                                          ║"
echo "║  访问: http://${SERVER_IP}                               ║"
echo "╚══════════════════════════════════════════════════════════╝"
