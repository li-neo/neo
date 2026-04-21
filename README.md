# Neo

Personal workspace, portfolio & AI-powered platform.

## Architecture

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
6. [Production Deployment](#6-production-deployment)
7. [CI/CD Auto-Deploy](#7-cicd-auto-deploy)
8. [Domain & HTTPS](#8-domain--https)
9. [Maintenance](#9-maintenance)
10. [Troubleshooting](#10-troubleshooting)

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

## 6. Production Deployment

Bare-metal installation with systemd services (no Docker).

### Architecture

```
Internet → Nginx (80/443) → ┬─ Next.js (3000)  Frontend
                             └─ FastAPI (8000)  Backend → MySQL
```

### 6.1 Server Requirements

| Resource    | Minimum              | Recommended          |
|-------------|----------------------|----------------------|
| CPU         | 2 cores              | 4 cores              |
| RAM         | 4 GB                 | 8 GB                 |
| Disk        | 30 GB SSD            | 40 GB ESSD           |
| OS          | CentOS Stream 9      | CentOS Stream 9      |

### 6.2 One-Click Setup

SSH into your ECS instance:

```bash
git clone https://ghfast.top/https://github.com/li-neo/neo.git /opt/neo
cd /opt/neo && bash infra/scripts/setup-ecs.sh
```

The script automatically installs Python 3.12, Node.js 22, MySQL 8, Nginx; builds the frontend; creates systemd services (`neo-server`, `neo-web`); runs migrations; starts everything.

### 6.3 Verify

```bash
systemctl status neo-server neo-web nginx mysqld
curl http://localhost/api/v1/projects
curl -sI http://localhost | head -5
```

---

## 7. CI/CD Auto-Deploy

Push to `main` triggers automatic deployment to your ECS instance.

### 7.1 Flow

```
Local Dev → git push main → GitHub Actions → SSH to ECS → auto-deploy.sh
                                  │
                            ┌─────┴─────┐
                            │  test job  │  Lint + Build verification
                            └─────┬─────┘
                                  │ Pass
                            ┌─────┴─────┐
                            │ deploy job │  SSH → git pull → build → migrate → restart
                            └───────────┘
```

### 7.2 GitHub Secrets

Configure in **GitHub repo → Settings → Secrets and variables → Actions**:

| Secret             | Description                     | Example           |
|--------------------|---------------------------------|-------------------|
| `DEPLOY_HOST`      | ECS public IP                   | `101.96.207.11`   |
| `DEPLOY_USER`      | SSH username                    | `root`            |
| `SSH_PRIVATE_KEY`  | SSH private key (full content)  | `-----BEGIN...`   |

### 7.3 Using `neo deploy`

The fastest way to deploy:

```bash
# Make changes, then:
neo deploy -m "feat: new feature"
```

This runs `git add -A && git commit && git push origin main`, then prints the GitHub Actions URL for tracking.

For emergencies (bypass CI):

```bash
neo deploy --direct
```

This SSHs directly to ECS and runs `auto-deploy.sh`.

### 7.4 Auto-Deploy Script

The ECS-side script (`infra/scripts/auto-deploy.sh`) performs:

1. **Save current revision** (for rollback)
2. **git pull** latest code
3. **uv sync** — install Python dependencies
4. **pnpm install && pnpm build** — build frontend (standalone mode)
5. **alembic upgrade head** — run database migrations
6. **systemctl restart** — restart `neo-server` and `neo-web`
7. **Health check** — verify backend responds on `/api/v1/health`
8. **Auto-rollback** — if any step fails, reverts to previous commit

### 7.5 Manual Deploy (Backup)

If GitHub Actions is unavailable:

```bash
# From local machine (requires DEPLOY_HOST in .env)
bash infra/scripts/deploy.sh
```

---

## 8. Domain & HTTPS

### 8.1 DNS

Add A records for `@` and `www` pointing to your server IP.

### 8.2 SSL (Let's Encrypt)

```bash
dnf install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com -d www.your-domain.com \
  --non-interactive --agree-tos -m your-email@example.com
echo "0 3 * * * certbot renew --quiet" | crontab -
```

Then update `.env`:

```env
CORS_ORIGINS=["https://your-domain.com","https://www.your-domain.com"]
GITHUB_REDIRECT_URI=https://your-domain.com/admin
```

```bash
systemctl restart neo-server
```

---

## 9. Maintenance

### Update

Recommended — use the CI/CD pipeline:

```bash
neo deploy -m "update description"
```

Or on the ECS server directly:

```bash
cd /opt/neo && bash infra/scripts/auto-deploy.sh
```

### Logs

```bash
journalctl -u neo-server -f
journalctl -u neo-web -f
```

### Database Backup

```bash
mysqldump -u neo -p neo > backup_$(date +%Y%m%d).sql
mysql -u neo -p neo < backup.sql
```

### Restart

```bash
systemctl restart neo-server neo-web nginx mysqld
```

---

## 10. Troubleshooting

### Service won't start (production)

```bash
journalctl -u neo-server -n 50
journalctl -u neo-web -n 50
```

### Port conflict (local dev)

```bash
neo stop
# or manually:
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Database connection error

```bash
systemctl status mysqld
mysql -u neo -p neo -e "SELECT 1"
```

### GitHub OAuth redirect error

Ensure callback URL matches in both GitHub OAuth App settings and `.env`:
- Dev: `http://localhost:3000/admin`
- Prod: `https://your-domain.com/admin`

### AI Chat not working

```bash
curl http://127.0.0.1:18789/v1/models    # Verify OpenClaw is running
```

`.env` settings:
```env
OPENCLAW_API_URL=http://127.0.0.1:18789
OPENCLAW_API_KEY=your-key
OPENCLAW_MODEL=openclaw/neo-web
```

---

## License

MIT
