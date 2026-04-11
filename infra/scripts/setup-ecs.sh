#!/usr/bin/env bash
# ============================================================
#  Neo 项目 — 火山引擎 ECS 裸机部署（无 Docker）
#  系统: CentOS Stream 9
#  用法: bash setup-ecs.sh
# ============================================================
set -euo pipefail

PROJECT_DIR=/opt/neo
SERVER_IP="101.96.207.11"

info()  { echo -e "\n\033[1;34m>>> $*\033[0m"; }
ok()    { echo -e "\033[1;32m  ✔ $*\033[0m"; }
warn()  { echo -e "\033[1;33m  ⚠ $*\033[0m"; }

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

# ── 3. 安装 uv ──
info "3/8 安装 uv"
export PATH="$HOME/.local/bin:$PATH"
if command -v uv &>/dev/null; then
    ok "uv 已存在: $(uv --version)"
else
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    grep -q '.local/bin' /root/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> /root/.bashrc
    ok "uv 已安装: $(uv --version)"
fi

# ── 4. 安装 Node.js 22 + pnpm ──
info "4/8 安装 Node.js 22 + pnpm"
if node --version 2>/dev/null | grep -q "v2[2-9]"; then
    ok "Node.js 已存在: $(node --version)"
else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
    dnf install -y -q nodejs
    ok "Node.js: $(node --version)"
fi
command -v pnpm &>/dev/null || npm install -g pnpm >/dev/null 2>&1
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

MYSQL_PW=$(openssl rand -hex 16)
mysql -u root <<SQLEOF 2>/dev/null || true
CREATE DATABASE IF NOT EXISTS neo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'neo'@'localhost' IDENTIFIED BY '${MYSQL_PW}';
GRANT ALL PRIVILEGES ON neo.* TO 'neo'@'localhost';
FLUSH PRIVILEGES;
SQLEOF
ok "数据库 neo 就绪, 密码: ${MYSQL_PW}"

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
    git clone https://github.com/li-neo/neo.git "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    ok "代码已拉取"
fi

# 后端
info "  → 安装后端 Python 依赖"
cd "$PROJECT_DIR/server"
uv sync --frozen 2>&1 | tail -3
mkdir -p uploads
ok "后端依赖就绪"

# 前端
info "  → 安装前端依赖 & 构建"
cd "$PROJECT_DIR/apps/web"
pnpm install --frozen-lockfile 2>&1 | tail -3
NEXT_PUBLIC_API_URL="http://127.0.0.1:8000" pnpm build 2>&1 | tail -5
ok "前端构建完成"

# ── 8. 生成配置 & systemd 服务 ──
info "8/8 配置文件 & 服务"

SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# — .env —
cat > "$PROJECT_DIR/.env" << ENVEOF
APP_NAME=neo
APP_ENV=production
DEBUG=false
SECRET_KEY=${SECRET_KEY}

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=neo
MYSQL_PASSWORD=${MYSQL_PW}
MYSQL_DATABASE=neo

API_HOST=0.0.0.0
API_PORT=8000
API_PREFIX=/api/v1
CORS_ORIGINS=["https://li-neo.top","https://www.li-neo.top","http://${SERVER_IP}"]

GITHUB_CLIENT_ID=Ov23liDKwcyG0mU9nfIW
GITHUB_CLIENT_SECRET=3125e66c1806dfd611409bca20a9b2471b28a68b
GITHUB_REDIRECT_URI=https://li-neo.top/admin

ADMIN_GITHUB_USERS=2995183552@qq.com

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

# — Nginx —
# 先删掉默认 server 块，避免端口冲突
rm -f /etc/nginx/conf.d/default.conf
cat > /etc/nginx/conf.d/neo.conf << 'NGEOF'
upstream neo_web { server 127.0.0.1:3000; }
upstream neo_api { server 127.0.0.1:8000; }

limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

server {
    listen 80;
    server_name li-neo.top www.li-neo.top _;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location /api/ {
        limit_req zone=api burst=20 nodelay;
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
ok "Nginx 配置就绪"

# — systemd: neo-server —
UV_BIN=$(which uv)
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
Environment=PATH=${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=${UV_BIN} run uvicorn app.main:app --host 0.0.0.0 --port 8000
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
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Environment=NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
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
uv run alembic upgrade head 2>&1 | tail -5
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
