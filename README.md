# Neo

Personal workspace, portfolio & AI-powered platform.

## Architecture

cd /opt/neo && git checkout main && git pull origin main && bash infra/scripts/auto-deploy.sh

```
neo/
├── apps/web/          → Next.js 15 frontend (App Router + Tailwind CSS 4)
├── server/            → FastAPI backend (Python 3.12 + SQLAlchemy 2.0)
├── tools/neo_cli/     → Neo CLI (Python-based, unified project management)
├── infra/             → Nginx, deploy scripts
└── Makefile           → Alternative make shortcuts (mirrors neo CLI)
```

## Tech Stack

| Layer         | Technology                                                        |
|---------------|-------------------------------------------------------------------|
| Frontend      | Next.js 15, React 19, Tailwind CSS 4, Framer Motion, Three.js    |
| Rich Editor   | BlockNote (Notion-style block editor)                             |
| Backend       | FastAPI, SQLAlchemy 2.0, Pydantic 2                              |
| Database      | SQLite (dev) / MySQL 8 (prod)                                    |
| Auth          | GitHub OAuth + JWT                                                |
| AI Chat       | OpenClaw (OpenAI-compatible) + SSE streaming                     |
| Deploy        | Bare-metal (systemd) on Volcengine ECS                           |
| Reverse Proxy | Nginx                                                            |


---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Neo CLI Reference](#2-neo-cli-reference)
3. [Admin Dashboard](#3-admin-dashboard)
4. [Database](#4-database)
5. [API Reference](#5-api-reference)
6. [ECS 首次部署（完整指南）](#6-ecs-首次部署完整指南)
7. [CI/CD 工作流](#7-cicd-工作流)
8. [维护](#8-维护)
9. [故障排查](#9-故障排查)

---

## 1. Quick Start

### Prerequisites

| Tool                  | Install                                               |
|-----------------------|-------------------------------------------------------|
| Python 3.12+          | `brew install python@3.12`                            |
| uv (Python pkg mgr)  | `curl -LsSf https://astral.sh/uv/install.sh \| sh`   |
| Node.js 22+           | `brew install node`                                   |
| pnpm                  | `npm install -g pnpm`                                 |

### 1.1 Clone & Install

```bash
git clone https://github.com/li-neo/neo.git && cd neo

# Make neo available globally (creates symlink in /usr/local/bin)
./neo setup-path

# Install all dependencies
neo install
```

### 1.2 Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Use SQLite for local dev (no MySQL needed)
DATABASE_URL_OVERRIDE=sqlite:///./neo.db

# GitHub OAuth App (https://github.com/settings/developers)
#   Homepage URL:  http://localhost:3000
#   Callback URL:  http://localhost:3000/admin
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/admin

# Your GitHub email — auto-assigned admin role on first login
ADMIN_GITHUB_USERS=your-email@example.com
```

### 1.3 Start Services

```bash
# Production-like mode (build + start, recommended)
neo start

# Or dev foreground mode (hot-reload, both services)
neo dev
```

### 1.4 Open Browser

| Page                | URL                            |
|---------------------|--------------------------------|
| Homepage            | http://localhost:3000           |
| Admin Dashboard     | http://localhost:3000/admin     |
| API Docs (Swagger)  | http://localhost:8000/docs      |
| Health Check        | http://localhost:8000/health    |

---

## 2. Neo CLI Reference

The `neo` command is the project's unified CLI. All project management should go through it.

```bash
# Install globally (one-time)
./neo setup-path      # Creates /usr/local/bin/neo symlink

# Then use from anywhere:
neo <command> [options]
```

### 2.1 Service Lifecycle

```bash
neo start                   # Start all services (build + production mode)
neo stop                    # Stop all services
neo restart                 # Restart all services
neo status                  # Show PID info and backend health
neo health                  # Check backend health
neo logs server             # Show recent backend logs
neo logs web                # Show recent frontend logs
neo dev                     # Foreground dev mode (hot-reload, both services)
neo dev server              # Dev mode — backend only
neo dev web                 # Dev mode — frontend only
```

These are shorthand for `neo system start/stop/...`. The full form also works:

```bash
neo system start
neo system logs server --lines 100
```

> `neo start` runs `infra/scripts/run-local.sh`: kills conflicting ports, builds the frontend, starts backend (uvicorn) and frontend (next start) in background with PID files under `.pids/`.

### 2.2 Authentication

```bash
neo auth login --token <jwt-token>        # Save JWT token locally
neo auth logout                            # Remove saved token
neo auth whoami                            # Show current identity
neo auth status                            # Check auth readiness
neo auth guide                             # Show auth instructions

# Browser-approved bootstrap (for remote CLI / OpenClaw)
neo auth bootstrap --client-name my-client
neo auth bootstrap --detach                # Return link, wait in background

# Personal access tokens
neo auth token-create --name my-token --expires-in-days 30
neo auth token-list
neo auth token-revoke --token-id 1
neo auth token-revoke --token-prefix neo_pat_xxx

# GitHub OAuth URL
neo auth github-url
```

### 2.3 Resource CRUD

All resource commands follow the same pattern: `neo <resource> <action> [options]`

```bash
# Projects
neo projects list
neo projects get my-project
neo projects create --slug my-proj --title "My Project" --category llm
neo projects update my-proj --title "New Title" --description "..." --patch
neo projects delete my-proj

# Blog Posts
neo posts list
neo posts get hello-world
neo posts create --slug hello --title "Hello" --content "..." --published
neo posts update hello --title "Updated" --tags "ai,ml"
neo posts delete hello

# Import posts from external sources
neo posts import-url https://example.com/article.md
neo posts import-file ./my-post.md

# Skills
neo skills list
neo skills get my-skill
neo skills create --slug my-skill --name "My Skill" --category ml
neo skills update my-skill --version "1.0.0"
neo skills delete my-skill

# Guestbook
neo guestbook list
neo guestbook create --nickname visitor --message "Hello!"
neo guestbook delete 42
```

### 2.4 Database

```bash
neo db upgrade                             # Apply pending migrations
neo db downgrade                           # Rollback one step
neo db downgrade -2                        # Rollback two steps
neo db revision -m "add user table"        # Generate new migration
neo db seed                                # Import seed data
```

### 2.5 OpenClaw Integration

```bash
neo openclaw install-skill                 # Install neo skill into local OpenClaw
neo openclaw bootstrap                     # Install skill + start browser-approved auth
```

### 2.6 Deployment

```bash
neo deploy                                # git add + commit + push main → GitHub Actions auto-deploys
neo deploy -m "feat: add search"          # Custom commit message
neo deploy --direct                       # Skip GitHub Actions; SSH deploy directly to ECS
neo deploy --skip-push                    # Don't commit/push; just show Actions URL
```

### 2.7 Utilities

```bash
neo install                                # Install all dependencies
neo clean                                  # Clean build artifacts
neo upload ./image.png                     # Upload a file
neo config show                            # Show CLI config
neo config set base_url http://...         # Change API base URL
neo api request GET /projects              # Raw API call
neo api request POST /posts --data '{"slug":"x","title":"X"}' --auth
```

### Make Shortcuts (alternative)

The Makefile provides equivalent shortcuts for those who prefer `make`:

```bash
make start / stop / restart      # Background process management
make dev-local                   # Foreground dev mode (SQLite)
make install / clean             # Dependencies & cleanup
make status / log-server / log-web
make db-upgrade / db-downgrade / seed
make help                        # Full command list
```

---

## 3. Admin Dashboard

### Login Flow

1. Visit http://localhost:3000/admin
2. Click **Sign in with GitHub**
3. Authorize the OAuth App
4. If your GitHub email matches `ADMIN_GITHUB_USERS` in `.env`, you get admin access

### Features

| Tab           | Operations                                           |
|---------------|------------------------------------------------------|
| Projects      | CRUD + **Import from GitHub** (one-click batch)      |
| Skills        | CRUD with rich text editor                           |
| Blog          | CRUD with **BlockNote rich text editor** + import    |
| Guestbook     | View, edit & delete messages                         |
| Uploads       | Upload images & videos (drag-drop, auto-compress)    |
| Chat Records  | View AI chat session history & messages              |

### Rich Text Editor

All content fields (blog content, project/skill descriptions) use BlockNote:
- **Slash menu** (`/`) — headings, images, videos, files, tables, code blocks
- **Formatting toolbar** — bold, italic, links, code, highlights
- **Drag & drop** — reorder blocks freely
- **File upload** — images/videos upload to server via `/api/v1/uploads`
- **Markdown compatible** — existing Markdown content auto-converts; export to `.md`

### Inline Editing on List Pages

Admin users see edit/delete buttons directly on `/projects`, `/blog`, `/skills` pages. Clicking **Edit** opens a side-panel editor with the same BlockNote integration — no need to visit `/admin` for quick edits.

### GitHub Project Import

In the Projects tab, click **Import from GitHub**:
- Enter a GitHub username or profile URL
- Select repos to import (shows language, stars, topics)
- Auto-generates cover image from GitHub OpenGraph
- Auto-detects category from topics/description
- Skips repos that already exist

---

## 4. Database

### Local Dev (SQLite)

Set in `.env`:

```env
DATABASE_URL_OVERRIDE=sqlite:///./neo.db
```

Database file: `server/neo.db` (auto-created on first start).

```bash
rm server/neo.db && neo db seed        # Reset & re-seed
neo db upgrade                         # Apply migrations
```

### Production (MySQL)

Remove `DATABASE_URL_OVERRIDE` from `.env` and configure MySQL:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=neo
MYSQL_PASSWORD=your-strong-password
MYSQL_DATABASE=neo
```

---

## 5. API Reference

Unified response format:

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "meta": { "pagination": { "page": 1, "page_size": 20, "total": 100 } }
}
```

| Module        | Prefix                 | Auth        | Description                     |
|---------------|------------------------|-------------|---------------------------------|
| Auth          | `/api/v1/auth`         | —           | GitHub OAuth login, JWT         |
| Projects      | `/api/v1/projects`     | Admin (CUD) | Project showcase CRUD           |
| Posts         | `/api/v1/posts`        | Admin (CUD) | Blog posts + import             |
| Skills        | `/api/v1/skills`       | Admin (CUD) | Skill management & publishing   |
| Guestbook     | `/api/v1/guestbook`    | Admin (UD)  | Public guestbook                |
| Uploads       | `/api/v1/uploads`      | Admin       | Image & video uploads           |
| Chat          | `/api/v1/chat`         | —           | AI chat (SSE streaming)         |
| GitHub Import | `/api/v1/github`       | Admin       | Import repos as projects        |
| Workspace     | `/api/v1/workspace`    | User        | Dashboard & task automation     |
| Integrations  | `/api/v1/integrations` | User        | GitHub / HuggingFace / OpenClaw |
| MCP           | `/api/v1/mcp`          | User        | Model Context Protocol gateway  |

Interactive docs (dev only): http://localhost:8000/docs

---

## 6. ECS 首次部署（完整指南）

裸机部署，systemd 管理进程，无 Docker。

```
Internet → Nginx (80/443) → ┬─ Next.js (:3000)  前端
                             └─ FastAPI (:8000)  后端 → MySQL
```

### 6.1 服务器要求

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 磁盘 | 30 GB SSD | 40 GB ESSD |
| 系统 | CentOS Stream 9 | CentOS Stream 9 |

### 6.2 Step 1 — 安装

通过火山引擎控制台 VNC（或 SSH）登录 ECS：

```bash
git clone https://ghfast.top/https://github.com/li-neo/neo.git /opt/neo
cd /opt/neo && bash infra/scripts/setup-ecs.sh
```

脚本自动完成：Python 3.12、Node.js 22、MySQL 8、Nginx 安装 → 后端/前端依赖 → 构建 → systemd 服务 → 数据库迁移 → 启动。

完成后记录输出的 **MySQL 密码**。

### 6.3 Step 2 — 配置 GitHub OAuth

1. 访问 https://github.com/settings/developers → **New OAuth App**
2. 填写：

| 字段 | 值 |
|------|----|
| Application name | `Neo` |
| Homepage URL | `https://li-neo.top` |
| Authorization callback URL | `https://li-neo.top/api/v1/auth/github/callback` |

3. 创建后获得 **Client ID** 和 **Client Secret**
4. 编辑 ECS 上的配置：

```bash
vim /opt/neo/.env
```

修改以下字段：

```env
GITHUB_CLIENT_ID=你的Client-ID
GITHUB_CLIENT_SECRET=你的Client-Secret
GITHUB_REDIRECT_URI=https://li-neo.top/api/v1/auth/github/callback
ADMIN_GITHUB_USERS=你的GitHub用户名或邮箱
```

```bash
systemctl restart neo-server
```

### 6.4 Step 3 — 域名解析

在域名注册商（或火山引擎云解析）添加 A 记录：

| 主机记录 | 类型 | 值 |
|---------|------|----|
| `@` | A | ECS 公网 IP |
| `www` | A | ECS 公网 IP |

验证解析生效（可能需要几分钟）：

```bash
ping li-neo.top
```

### 6.5 Step 4 — HTTPS 证书

```bash
dnf install -y certbot python3-certbot-nginx
certbot --nginx -d li-neo.top -d www.li-neo.top \
  --non-interactive --agree-tos -m 你的邮箱@example.com
```

certbot 会自动修改 Nginx 配置，添加 443 监听和证书路径。设置自动续期：

```bash
echo "0 3 * * * certbot renew --quiet" | crontab -
```

### 6.6 Step 5 — 验证

```bash
# 服务状态
systemctl status neo-server neo-web nginx mysqld

# API 测试
curl https://li-neo.top/api/v1/projects

# 首页
curl -sI https://li-neo.top | head -5
```

浏览器访问：

| 页面 | URL |
|------|-----|
| 首页 | https://li-neo.top |
| 管理后台 | https://li-neo.top/admin → 点击 GitHub 登录 |
| API 文档 | 仅开发模式可用 (DEBUG=true) |

### 6.7 Step 6 — 配置 CI/CD 自动部署

完成首次部署后，配置自动更新，让后续每次 `git push main` 自动部署到 ECS。

**a) 添加部署公钥到 ECS**

在本地生成密钥对（如果已有可跳过）：

```bash
ssh-keygen -t ed25519 -C "neo-deploy" -f ~/.ssh/neo_deploy -N ""
```

在 ECS 上添加公钥：

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "你的公钥内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**b) 配置 GitHub Secrets**

进入 https://github.com/li-neo/neo/settings/secrets/actions ，添加：

| Secret | 值 |
|--------|----|
| `DEPLOY_HOST` | ECS 公网 IP |
| `DEPLOY_USER` | `root` |
| `SSH_PRIVATE_KEY` | `~/.ssh/neo_deploy` 私钥完整内容 |

或用 `gh` CLI 一键配置：

```bash
gh secret set SSH_PRIVATE_KEY < ~/.ssh/neo_deploy
gh secret set DEPLOY_HOST --body "你的ECS-IP"
gh secret set DEPLOY_USER --body "root"
```

**c) 测试自动部署**

```bash
neo deploy -m "test: verify CI/CD pipeline"
```

在 https://github.com/li-neo/neo/actions 查看流水线执行情况。

---

## 7. CI/CD 工作流

### 7.1 自动部署流程

```
neo deploy -m "msg" → git push main → GitHub Actions
                                          │
                                    ┌─────┴─────┐
                                    │  test job  │  lint + build 验证
                                    └─────┬─────┘
                                          │ 通过
                                    ┌─────┴─────┐
                                    │ deploy job │  SSH → auto-deploy.sh
                                    └───────────┘
                                          │
                              git pull → build → migrate → restart → 健康检查
```

### 7.2 `neo deploy` 命令

```bash
neo deploy -m "feat: new feature"     # 提交 + 推送 + Actions 自动部署
neo deploy --direct                   # 紧急: 跳过 CI，直接 SSH 部署
neo deploy --skip-push                # 不提交，仅显示 Actions URL
```

### 7.3 ECS 端自动部署脚本

`infra/scripts/auto-deploy.sh` 被 GitHub Actions SSH 调用，执行：

1. 记录当前版本（用于回滚）
2. `git pull` 拉取最新代码
3. `pip install` 安装后端依赖
4. `pnpm install && pnpm build` 构建前端（standalone 模式）
5. `alembic upgrade head` 数据库迁移
6. `systemctl restart` 重启 neo-server、neo-web
7. 健康检查 `/api/v1/health`
8. 任意步骤失败 → 自动回滚到上一个 commit

### 7.4 手动部署（备用）

```bash
# 本地 SSH 触发（需要 .env 中配置 DEPLOY_HOST）
bash infra/scripts/deploy.sh

# 或直接在 ECS 上执行
cd /opt/neo && bash infra/scripts/auto-deploy.sh
```

---

## 8. 维护

### 日常更新

```bash
neo deploy -m "update description"
```

### 查看日志

```bash
journalctl -u neo-server -f      # 后端实时日志
journalctl -u neo-web -f         # 前端实时日志
```

### 数据库备份 / 恢复

```bash
mysqldump -u neo -p neo > backup_$(date +%Y%m%d).sql
mysql -u neo -p neo < backup.sql
```

### 重启服务

```bash
systemctl restart neo-server neo-web nginx mysqld
```

---

## 9. 故障排查

### 服务无法启动

```bash
journalctl -u neo-server -n 50
journalctl -u neo-web -n 50
```

### 端口冲突（本地开发）

```bash
neo stop
```

### 数据库连接失败

```bash
systemctl status mysqld
mysql -u neo -p neo -e "SELECT 1"
```

### GitHub OAuth 回调错误

确认 GitHub OAuth App 设置和 `.env` 中的回调地址一致：
- 本地开发: `http://localhost:8000/api/v1/auth/github/callback`
- 生产环境: `https://li-neo.top/api/v1/auth/github/callback`

### AI Chat 不工作

```bash
curl http://127.0.0.1:18789/v1/models
```

检查 `.env`：

```env
OPENCLAW_API_URL=http://127.0.0.1:18789
OPENCLAW_API_KEY=your-key
OPENCLAW_MODEL=openclaw/neo-web
```

---

## License

MIT
