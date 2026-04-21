#!/usr/bin/env bash
# ============================================================
#  Neo — 火山引擎 ECS 裸机部署 (CentOS Stream 9, 无 Docker)
#  用法: bash setup-ecs.sh
#  幂等: 可重复执行，已有配置不会被覆盖
# ============================================================
set -euo pipefail

PROJECT_DIR=/opt/neo
ENV_FILE="${PROJECT_DIR}/.env"

# ---------- 可通过环境变量覆盖的配置 ----------
GIT_REPO_URL="${GIT_REPO_URL:-https://github.com/li-neo/neo.git}"
PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
VENV_DIR="${VENV_DIR:-${PROJECT_DIR}/server/.venv}"

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

# 从已有 .env 继承配置（幂等关键：不丢失已配好的值）
if [ -f "$ENV_FILE" ]; then
    _env_val() { grep -E "^${1}=" "$ENV_FILE" | tail -1 | cut -d'=' -f2- || true; }
    _v="$(_env_val NEXT_PUBLIC_SITE_URL)"
    if [ -n "$_v" ]; then
        SITE_URL="$_v"
        SITE_SCHEME="${SITE_URL%%://*}"
        PRIMARY_DOMAIN="$(echo "$SITE_URL" | sed -E 's,^https?://([^/:]+).*,\1,')"
        WWW_DOMAIN="www.${PRIMARY_DOMAIN#www.}"
        SITE_URL_WWW="${SITE_SCHEME}://${WWW_DOMAIN}"
    fi
    for _k in NEXT_PUBLIC_API_URL:PUBLIC_API_BASE_URL GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GITHUB_REDIRECT_URI ADMIN_GITHUB_USERS; do
        _env="${_k%%:*}"; _var="${_k##*:}"
        _v="$(_env_val "$_env")"
        [ -n "$_v" ] && eval "${_var}=\$_v"
    done
    unset _env_val _v _k _env _var
fi

echo "╔═══════════════════════════════════════════╗"
echo "║   Neo — 裸机部署 (无 Docker)              ║"
echo "╚═══════════════════════════════════════════╝"

# ── 1. 基础工具 ──
info "1/6 基础工具"
dnf install -y -q git curl wget tar gcc make openssl-devel bzip2-devel \
    libffi-devel zlib-devel readline-devel sqlite-devel
ok "就绪"

# ── 2. Python 3.12 + Node.js 22 + pnpm ──
info "2/6 运行时环境"
if python3 --version 2>/dev/null | grep -q "3.1[2-9]"; then
    ok "Python: $(python3 --version)"
else
    dnf install -y python3.12 python3.12-pip python3.12-devel
    ln -sf /usr/bin/python3.12 /usr/bin/python3
    ok "Python: $(python3 --version)"
fi
python3 -m pip --version >/dev/null 2>&1 || dnf install -y python3-pip

if node --version 2>/dev/null | grep -q "v2[2-9]"; then
    ok "Node.js: $(node --version)"
else
    curl --retry 3 --retry-delay 2 --retry-all-errors -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
    dnf install -y -q nodejs
    ok "Node.js: $(node --version)"
fi
command -v pnpm &>/dev/null || npm install -g pnpm --registry "$NPM_REGISTRY" >/dev/null 2>&1
pnpm config set registry "$NPM_REGISTRY" >/dev/null 2>&1 || true
ok "pnpm: $(pnpm --version)"

# ── 3. MySQL 8 + Nginx ──
info "3/6 MySQL & Nginx"
if systemctl is-active mysqld &>/dev/null; then
    ok "MySQL 已在运行"
else
    dnf install -y -q mysql-server
    systemctl enable --now mysqld
    ok "MySQL 已启动"
fi

MYSQL_HOST="${MYSQL_HOST:-localhost}"; MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-neo}"; MYSQL_DATABASE="${MYSQL_DATABASE:-neo}"
if [ -f "$ENV_FILE" ]; then
    for _k in MYSQL_HOST MYSQL_PORT MYSQL_USER MYSQL_DATABASE MYSQL_PASSWORD; do
        _v="$(grep -E "^${_k}=" "$ENV_FILE" | tail -1 | cut -d'=' -f2- || true)"
        [ -n "$_v" ] && eval "${_k}=\$_v"
    done
fi
MYSQL_PW="${MYSQL_PASSWORD:-}"
if [ -z "$MYSQL_PW" ]; then
    MYSQL_PW=$(openssl rand -hex 16)
    warn "生成新 MySQL 密码"
fi

if [ "$MYSQL_HOST" = "localhost" ] || [ "$MYSQL_HOST" = "127.0.0.1" ]; then
    if mysql -u "$MYSQL_USER" -p"$MYSQL_PW" -e "SELECT 1" "$MYSQL_DATABASE" &>/dev/null; then
        ok "数据库连接验证通过"
    else
        mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PW}';
ALTER USER '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PW}';
GRANT ALL PRIVILEGES ON ${MYSQL_DATABASE}.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
        ok "数据库 ${MYSQL_DATABASE} 初始化完成"
    fi
fi

command -v nginx &>/dev/null || { dnf install -y -q nginx; systemctl enable nginx; }
ok "Nginx 就绪"

# ── 4. 拉取代码 & 安装依赖 ──
info "4/6 代码 & 依赖"
if [ -d "$PROJECT_DIR/.git" ]; then
    cd "$PROJECT_DIR" && git pull origin main
else
    git clone "$GIT_REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

cd "$PROJECT_DIR/server"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install -U pip setuptools wheel -q -i "$PIP_INDEX_URL" --default-timeout=120
"$VENV_DIR/bin/pip" install -q -i "$PIP_INDEX_URL" --default-timeout=120 \
    $(python3 -c "import tomllib,pathlib;[print(d) for d in tomllib.loads(pathlib.Path('pyproject.toml').read_text()).get('project',{}).get('dependencies',[])]")
mkdir -p uploads
ok "后端依赖就绪"

cd "$PROJECT_DIR/apps/web"
pnpm install --frozen-lockfile 2>/dev/null
NEXT_PUBLIC_API_URL="$PUBLIC_API_BASE_URL" NEXT_PUBLIC_SITE_URL="$SITE_URL" INTERNAL_API_URL="http://127.0.0.1:8000" pnpm build
ok "前端构建完成"

# ── 5. 配置文件 & 服务 ──
info "5/6 配置"

SECRET_KEY="$(grep -E '^SECRET_KEY=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2- || true)"
JWT_SECRET="$(grep -E '^JWT_SECRET_KEY=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2- || true)"
[ -n "$SECRET_KEY" ] || SECRET_KEY=$(openssl rand -hex 32)
[ -n "$JWT_SECRET" ] || JWT_SECRET=$(openssl rand -hex 32)

if [ -f "$ENV_FILE" ]; then
    ok ".env 已存在，保留现有配置"
else
cat > "$ENV_FILE" <<EOF
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
CORS_ORIGINS=["${SITE_URL}","${SITE_URL_WWW}"]

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
EOF
ok ".env 已生成"
fi

# Nginx — 已有 SSL 配置时不覆盖
rm -f /etc/nginx/conf.d/default.conf
if [ -f /etc/nginx/conf.d/neo.conf ] && grep -q "ssl_certificate" /etc/nginx/conf.d/neo.conf 2>/dev/null; then
    ok "Nginx SSL 配置已存在，跳过"
else
cat > /etc/nginx/conf.d/neo.conf <<'NGEOF'
upstream neo_web { server 127.0.0.1:3000; }
upstream neo_api { server 127.0.0.1:8000; }

# ── Rate limiting zones ──
limit_req_zone $binary_remote_addr zone=global:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=chat:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=3r/s;
limit_conn_zone $binary_remote_addr zone=perip:10m;

server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Global connection limit
    limit_conn perip 50;

    # Block common scanner user agents
    if ($http_user_agent ~* (nmap|nikto|wikto|sf|sqlmap|bsqlbf|w3af|acunetix|havij|appscan)) {
        return 403;
    }

    # Chat endpoint — strict rate limit
    location /api/v1/chat/ {
        limit_req zone=chat burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://neo_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
        proxy_buffering off;
        proxy_cache off;
    }

    # Auth endpoint — strict rate limit
    location /api/v1/auth/ {
        limit_req zone=auth burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://neo_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # General API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://neo_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
        limit_req zone=global burst=30 nodelay;
        proxy_pass http://neo_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGEOF
sed -i "s/DOMAIN_PLACEHOLDER/${PRIMARY_DOMAIN} ${WWW_DOMAIN} _/" /etc/nginx/conf.d/neo.conf
ok "Nginx 配置就绪"
fi

# systemd
NODE_BIN=$(which node)
cat > /etc/systemd/system/neo-server.service <<EOF
[Unit]
Description=Neo Backend (FastAPI)
After=network.target mysqld.service
Wants=mysqld.service
[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}/server
EnvironmentFile=${ENV_FILE}
ExecStart=${VENV_DIR}/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/neo-web.service <<EOF
[Unit]
Description=Neo Frontend (Next.js)
After=network.target neo-server.service
[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}/apps/web
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
ExecStart=${NODE_BIN} .next/standalone/server.js
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

# 防火墙
systemctl enable --now firewalld 2>/dev/null || true
for rule in http https 22/tcp; do firewall-cmd --permanent --add-service="$rule" 2>/dev/null || firewall-cmd --permanent --add-port="$rule" 2>/dev/null || true; done
firewall-cmd --reload 2>/dev/null || true

# ── 6. 迁移 & 启动 ──
info "6/6 启动"
cd "$PROJECT_DIR/server"
"$VENV_DIR/bin/python" -m alembic upgrade head

systemctl daemon-reload
systemctl enable neo-server neo-web nginx
systemctl restart mysqld neo-server
sleep 3
systemctl restart neo-web
sleep 2
nginx -t && systemctl restart nginx

echo ""
echo "════════════════════════════════════════"
echo "  ✅ 部署完成"
echo "────────────────────────────────────────"
for svc in mysqld neo-server neo-web nginx; do
    if systemctl is-active "$svc" &>/dev/null; then
        echo "  🟢 $svc"
    else
        echo "  🔴 $svc  → journalctl -u $svc -n 30"
    fi
done
echo "────────────────────────────────────────"
echo "  MySQL 密码: ${MYSQL_PW}"
echo "  配置文件:   ${ENV_FILE}"
echo "  访问:       http://${PRIMARY_DOMAIN}"
echo "════════════════════════════════════════"
