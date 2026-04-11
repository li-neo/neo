#!/usr/bin/env bash
# ============================================================
#  Neo 项目 — 火山引擎 ECS 一键部署脚本
#  系统: CentOS Stream 9
#  在 ECS 上以 root 用户运行:
#    curl -sL https://raw.githubusercontent.com/li-neo/neo/main/infra/scripts/setup-ecs.sh | bash
#  或复制此脚本到服务器后执行:
#    bash setup-ecs.sh
# ============================================================
set -e

echo "╔═══════════════════════════════════════╗"
echo "║   Neo 项目 ECS 部署脚本              ║"
echo "╚═══════════════════════════════════════╝"

# ── 1. 系统更新 & 基础工具 ──
echo ""
echo "=== 1/7 系统更新 & 安装基础工具 ==="
dnf update -y
dnf install -y git curl wget unzip vim firewalld

# ── 2. 安装 Docker ──
echo ""
echo "=== 2/7 安装 Docker ==="
if ! command -v docker &>/dev/null; then
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "Docker 已安装: $(docker --version)"
else
    echo "Docker 已存在: $(docker --version)"
fi

# 确保 docker compose plugin 可用
docker compose version || {
    echo "安装 docker-compose-plugin..."
    dnf install -y docker-compose-plugin
}

# ── 3. 防火墙配置 ──
echo ""
echo "=== 3/7 配置防火墙 ==="
systemctl enable firewalld
systemctl start firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=22/tcp
firewall-cmd --permanent --add-port=8000/tcp
firewall-cmd --reload
echo "防火墙已配置: HTTP/HTTPS/SSH/8000"

# ── 4. 拉取项目代码 ──
echo ""
echo "=== 4/7 拉取项目代码 ==="
PROJECT_DIR=/opt/neo
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    git pull origin main
    echo "代码已更新"
else
    git clone https://github.com/li-neo/neo.git "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    echo "代码已拉取"
fi

# ── 5. 创建生产环境配置 ──
echo ""
echo "=== 5/7 创建生产环境配置 ==="
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cat > "$PROJECT_DIR/.env" << 'ENVEOF'
# ============================================================
# Neo Project — Production Configuration
# ============================================================

APP_NAME=neo
APP_ENV=production
DEBUG=false
SECRET_KEY=CHANGE_ME_TO_RANDOM_STRING_32_CHARS

# ---------- Database (Docker MySQL) ----------
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=neo
MYSQL_PASSWORD=CHANGE_ME_MYSQL_PASSWORD
MYSQL_DATABASE=neo

# ---------- FastAPI ----------
API_HOST=0.0.0.0
API_PORT=8000
API_PREFIX=/api/v1
CORS_ORIGINS=["https://li-neo.top","https://www.li-neo.top","http://101.96.207.11"]

# ---------- GitHub OAuth ----------
GITHUB_CLIENT_ID=Ov23liDKwcyG0mU9nfIW
GITHUB_CLIENT_SECRET=3125e66c1806dfd611409bca20a9b2471b28a68b
GITHUB_REDIRECT_URI=https://li-neo.top/admin

# ---------- Admin ----------
ADMIN_GITHUB_USERS=2995183552@qq.com

# ---------- JWT ----------
JWT_SECRET_KEY=CHANGE_ME_JWT_SECRET_32_CHARS
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# ---------- Uploads ----------
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=50

# ---------- OpenClaw (留空则禁用 AI 聊天) ----------
OPENCLAW_API_URL=
OPENCLAW_API_KEY=
OPENCLAW_MODEL=openclaw/neo-web
MCP_ENABLED=false

# ---------- Chat ----------
CHAT_SYSTEM_PROMPT=
ENVEOF

    echo ""
    echo "⚠️  重要：请编辑 $PROJECT_DIR/.env 修改以下内容："
    echo "   1. SECRET_KEY      — 改为一个随机字符串"
    echo "   2. MYSQL_PASSWORD  — 改为一个强密码"
    echo "   3. JWT_SECRET_KEY  — 改为一个随机字符串"
    echo "   运行: vim $PROJECT_DIR/.env"
    echo ""
    echo "   生成随机密钥: openssl rand -hex 32"
    echo ""
else
    echo ".env 已存在，跳过"
fi

# ── 6. 更新 Nginx 配置 ──
echo ""
echo "=== 6/7 配置 Nginx ==="
cat > "$PROJECT_DIR/infra/nginx/nginx.conf" << 'NGINXEOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;
    client_max_body_size 50m;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    # Upstream
    upstream web  { server web:3000; }
    upstream api  { server server:8000; }

    # HTTP → redirect to HTTPS (enable after SSL cert ready)
    # server {
    #     listen 80;
    #     server_name li-neo.top www.li-neo.top;
    #     return 301 https://$host$request_uri;
    # }

    # Main server (HTTP for now, switch to HTTPS later)
    server {
        listen 80;
        server_name li-neo.top www.li-neo.top 101.96.207.11;

        # API
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 180s;

            # SSE support (for chat streaming)
            proxy_buffering off;
            proxy_cache off;
        }

        # Uploads (static files)
        location /uploads/ {
            alias /app/uploads/;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # Frontend
        location / {
            proxy_pass http://web;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }

    # HTTPS (uncomment after certbot)
    # server {
    #     listen 443 ssl http2;
    #     server_name li-neo.top www.li-neo.top;
    #
    #     ssl_certificate     /etc/nginx/certs/fullchain.pem;
    #     ssl_certificate_key /etc/nginx/certs/privkey.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #
    #     location /api/ { ... same as above ... }
    #     location /uploads/ { ... same as above ... }
    #     location / { ... same as above ... }
    # }
}
NGINXEOF
echo "Nginx 配置已更新"

# ── 7. 更新 docker-compose 生产配置 ──
echo ""
echo "=== 7/7 更新 Docker Compose 配置 ==="
cat > "$PROJECT_DIR/docker-compose.prod.yml" << 'DCEOF'
services:
  mysql:
    image: mysql:8.0
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-neo}
      MYSQL_USER: ${MYSQL_USER:-neo}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - neo

  server:
    build:
      context: .
      dockerfile: infra/dockerfiles/Dockerfile.server
    restart: always
    env_file: .env
    environment:
      MYSQL_HOST: mysql
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - neo

  web:
    build:
      context: .
      dockerfile: infra/dockerfiles/Dockerfile.web
    restart: always
    environment:
      NEXT_PUBLIC_API_URL: http://server:8000
    depends_on:
      - server
    networks:
      - neo

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infra/nginx/certs:/etc/nginx/certs:ro
      - ./uploads:/app/uploads:ro
    depends_on:
      - web
      - server
    networks:
      - neo

volumes:
  mysql_data:

networks:
  neo:
    driver: bridge
DCEOF
echo "Docker Compose 生产配置已创建"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  ✅ 基础环境配置完成!                                ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "║  接下来请手动执行:                                    ║"
echo "║                                                       ║"
echo "║  1. 编辑密钥（必须!）:                                ║"
echo "║     cd /opt/neo                                       ║"
echo "║     vim .env                                          ║"
echo "║     # 修改 SECRET_KEY, MYSQL_PASSWORD, JWT_SECRET_KEY ║"
echo "║                                                       ║"
echo "║  2. 构建并启动:                                       ║"
echo "║     docker compose -f docker-compose.prod.yml build   ║"
echo "║     docker compose -f docker-compose.prod.yml up -d   ║"
echo "║                                                       ║"
echo "║  3. 初始化数据库:                                     ║"
echo "║     docker compose -f docker-compose.prod.yml exec \  ║"
echo "║       server uv run alembic upgrade head              ║"
echo "║                                                       ║"
echo "║  4. 查看状态:                                         ║"
echo "║     docker compose -f docker-compose.prod.yml ps      ║"
echo "║     docker compose -f docker-compose.prod.yml logs -f ║"
echo "║                                                       ║"
echo "║  访问: http://101.96.207.11                           ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
