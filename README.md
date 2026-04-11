# Neo

Personal workspace, portfolio & AI-powered automation platform.

## Architecture

```
neo/
├── apps/web/          → Next.js 15 frontend (App Router + Tailwind CSS 4)
├── server/            → FastAPI backend (Python 3.12 + SQLAlchemy 2.0)
├── infra/             → Docker, Nginx, deploy scripts
├── content/           → MDX content (projects, posts, skills)
└── docker-compose.yml → Full-stack orchestration
```

## Tech Stack

| Layer         | Technology                                                        |
|---------------|-------------------------------------------------------------------|
| Frontend      | Next.js 15, React 19, Tailwind CSS 4, Framer Motion, Three.js    |
| Backend       | FastAPI, SQLAlchemy 2.0, Pydantic 2                               |
| Database      | SQLite (dev) / MySQL 8.0 (prod)                                   |
| Auth          | GitHub OAuth + JWT                                                 |
| AI Chat       | OpenClaw (OpenAI-compatible) + SSE streaming                      |
| Deploy        | Docker Compose → Volcengine ECS                                   |
| CI/CD         | GitHub Actions                                                     |
| Reverse Proxy | Nginx (HTTP/HTTPS + SSE)                                          |

---

## Table of Contents

1. [Local Development](#1-local-development)
2. [Neo CLI](#2-neo-cli)
3. [Admin Dashboard](#3-admin-dashboard)
4. [Database](#4-database)
5. [API Reference](#5-api-reference)
6. [Production Deployment (Volcengine ECS)](#6-production-deployment-volcengine-ecs)
7. [Domain & HTTPS](#7-domain--https)
8. [Maintenance](#8-maintenance)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Local Development

### Prerequisites

| Tool                  | Install                                               |
|-----------------------|-------------------------------------------------------|
| Python 3.11+          | `brew install python@3.12`                            |
| uv (Python pkg mgr)  | `curl -LsSf https://astral.sh/uv/install.sh \| sh`   |
| Node.js 20+           | `brew install node`                                   |
| pnpm                  | `npm install -g pnpm`                                 |

### 1.1 Clone & Install

```bash
git clone https://github.com/li-neo/neo.git && cd neo

# One-command install (or manually: cd server && uv sync && cd ../apps/web && pnpm install)
neo install
```

### 1.2 Configure Environment

```bash
cp .env.example .env
```

Edit `.env`, fill in the required values:

```env
# GitHub OAuth App (https://github.com/settings/developers → New OAuth App)
#   Homepage URL:  http://localhost:3000
#   Callback URL:  http://localhost:3000/admin
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/admin

# Your GitHub email → auto-gets admin role
ADMIN_GITHUB_USERS=your-email@example.com
```

### 1.3 Start Services

```bash
# Background mode (recommended)
neo start

# Or foreground mode (logs print to terminal)
neo dev
```

### 1.4 Seed Sample Data (optional)

```bash
neo db seed
```

### 1.5 Open Browser

| Page                | URL                            |
|---------------------|--------------------------------|
| Homepage            | http://localhost:3000           |
| Admin Dashboard     | http://localhost:3000/admin     |
| API Docs (Swagger)  | http://localhost:8000/docs      |
| Health Check        | http://localhost:8000/health    |

---

## 2. Neo CLI

The `neo` command is the project's unified CLI. Add to PATH:

```bash
# Auto-added on first install, or manually:
export PATH="/path/to/neo:$PATH"
```

### Service Management

```bash
neo start              # Start all (backend + frontend)
neo stop               # Stop all
neo restart            # Restart all
neo start server       # Start backend only
neo stop server        # Stop backend only
neo restart server     # Restart backend only
neo start web          # Start frontend only
neo stop web           # Stop frontend only
neo restart web        # Restart frontend only
```

### Monitoring

```bash
neo status             # Show running status
neo log server         # Tail backend logs (real-time)
neo log web            # Tail frontend logs (real-time)
neo log                # Show recent log summary
```

### Development

```bash
neo dev                # Foreground mode (both services)
neo dev server         # Foreground backend only
neo dev web            # Foreground frontend only
neo install            # Install all dependencies
neo clean              # Clean build artifacts
```

### Database

```bash
neo db migrate [msg]   # Generate migration script
neo db upgrade         # Apply migrations
neo db downgrade       # Rollback one step
neo db seed            # Import seed data
```

### Quick Reference

```bash
neo help               # Show full command list
```

---

## 3. Admin Dashboard

### Login Flow

1. Visit http://localhost:3000/admin
2. Click **Sign in with GitHub**
3. Authorize → redirect back
4. If your GitHub email matches `ADMIN_GITHUB_USERS`, you get admin access

### Features

| Tab           | Operations                                    |
|---------------|-----------------------------------------------|
| Projects      | CRUD + **Import from GitHub** (one-click)     |
| Skills        | CRUD for OpenClaw skills & tools              |
| Blog          | CRUD with Markdown editor                     |
| Guestbook     | View & delete messages                        |
| Media         | Upload images & videos (auto-compress)        |
| Chat Records  | View AI chat session history                  |

### GitHub Project Import

In the Projects tab, click **Import from GitHub**:
- Enter a GitHub username or URL
- Select repos to import (shows language, stars, topics)
- Auto-generates cover image from GitHub OpenGraph
- Auto-detects category from topics/description
- Skips repos that already exist

---

## 4. Database

### Local Dev (SQLite)

Database file: `server/neo.db` (auto-created on first start).

```bash
# Reset database
rm server/neo.db && neo db seed

# Seed sample data
neo db seed
```

### Production (MySQL)

MySQL runs in Docker. Switch via `.env`:

```env
# SQLite (local dev):
DATABASE_URL_OVERRIDE=sqlite:///./neo.db

# MySQL (production): comment out the above, set:
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=neo
MYSQL_PASSWORD=your-strong-password
MYSQL_DATABASE=neo
```

---

## 5. API Reference

All APIs follow a unified response format:

```json
{
  "code": 0,
  "message": "ok",
  "data": { },
  "meta": { "pagination": { "page": 1, "page_size": 20, "total": 100 } }
}
```

| Module        | Prefix                  | Auth        | Description                      |
|---------------|-------------------------|-------------|----------------------------------|
| Auth          | `/api/v1/auth`          | —           | GitHub OAuth login, JWT          |
| Projects      | `/api/v1/projects`      | Admin (CUD) | Project showcase CRUD            |
| Posts         | `/api/v1/posts`         | Admin (CUD) | Blog posts                       |
| Skills        | `/api/v1/skills`        | Admin (CUD) | Skill management & publishing    |
| Guestbook     | `/api/v1/guestbook`     | Admin (D)   | Public guestbook                 |
| Uploads       | `/api/v1/uploads`       | Admin       | Image & video uploads            |
| Chat          | `/api/v1/chat`          | —           | AI chat (SSE streaming)          |
| GitHub Import | `/api/v1/github`        | Admin       | Import repos as projects         |
| Workspace     | `/api/v1/workspace`     | User        | Dashboard & task automation      |
| Integrations  | `/api/v1/integrations`  | User        | GitHub / HuggingFace / OpenClaw  |
| MCP           | `/api/v1/mcp`           | User        | Model Context Protocol gateway   |

Full interactive docs: http://localhost:8000/docs

---

## 6. Production Deployment (Volcengine ECS)

### Overview

```
Internet → Nginx (80/443) → ┬─ Next.js (3000)  Frontend
                             └─ FastAPI (8000)  Backend → MySQL
```

### 6.1 Server Requirements

| Resource    | Minimum         | Recommended     |
|-------------|-----------------|-----------------|
| CPU         | 2 cores         | 4 cores         |
| RAM         | 4 GB            | 8 GB            |
| Disk        | 30 GB SSD       | 40 GB ESSD      |
| OS          | CentOS 9 / Ubuntu 22.04 | CentOS Stream 9 |

### 6.2 One-Click Setup

SSH into your ECS instance, then run:

```bash
curl -sL https://raw.githubusercontent.com/li-neo/neo/main/infra/scripts/setup-ecs.sh | bash
```

This script automatically:
- Installs Docker & Docker Compose
- Configures firewall (22/80/443)
- Clones the project to `/opt/neo`
- Generates `.env` and `docker-compose.prod.yml`
- Configures Nginx with SSE support

### 6.3 Configure Secrets

```bash
cd /opt/neo

# Generate random secrets
SECRET=$(openssl rand -hex 32)
JWTKEY=$(openssl rand -hex 32)
MYSQLPW=$(openssl rand -hex 16)

# Apply to .env
sed -i "s/CHANGE_ME_TO_RANDOM_STRING_32_CHARS/$SECRET/" .env
sed -i "s/CHANGE_ME_JWT_SECRET_32_CHARS/$JWTKEY/" .env
sed -i "s/CHANGE_ME_MYSQL_PASSWORD/$MYSQLPW/g" .env

# Verify
grep -E 'SECRET_KEY|MYSQL_PASSWORD|JWT_SECRET' .env
```

### 6.4 Build & Start

```bash
cd /opt/neo

# Build all images (first time ~5-10 minutes)
docker compose -f docker-compose.prod.yml build

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status (wait until all 4 containers are "Up")
docker compose -f docker-compose.prod.yml ps
```

### 6.5 Verify

```bash
# Test API
curl http://localhost/api/v1/projects

# Test frontend
curl -sI http://localhost | head -5
```

Visit in browser: `http://<your-server-ip>`

---

## 7. Domain & HTTPS

### 7.1 DNS Configuration

In your domain registrar's DNS settings (e.g. Aliyun), add:

| Type | Host   | Value             | TTL  |
|------|--------|-------------------|------|
| A    | @      | `<your-server-ip>` | 600  |
| A    | www    | `<your-server-ip>` | 600  |

Wait for DNS propagation (usually 5-30 minutes):

```bash
# Verify from ECS
dig li-neo.top +short
```

### 7.2 SSL Certificate (Let's Encrypt)

After DNS is resolving:

```bash
# Install certbot
dnf install -y certbot    # CentOS
# apt install -y certbot  # Ubuntu

# Stop nginx temporarily
docker compose -f docker-compose.prod.yml stop nginx

# Request certificate
certbot certonly --standalone \
  -d li-neo.top -d www.li-neo.top \
  --agree-tos -m your-email@example.com

# Copy certs to project
cp /etc/letsencrypt/live/li-neo.top/fullchain.pem /opt/neo/infra/nginx/certs/
cp /etc/letsencrypt/live/li-neo.top/privkey.pem /opt/neo/infra/nginx/certs/
```

### 7.3 Enable HTTPS in Nginx

Edit `/opt/neo/infra/nginx/nginx.conf`:

1. **Uncomment** the HTTP→HTTPS redirect server block
2. **Uncomment** the HTTPS server block
3. **Comment out** the HTTP main server block

Then restart:

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 7.4 Auto-Renew Certificate

```bash
# Add crontab entry
echo "0 3 1 */2 * certbot renew --quiet && cp /etc/letsencrypt/live/li-neo.top/*.pem /opt/neo/infra/nginx/certs/ && cd /opt/neo && docker compose -f docker-compose.prod.yml restart nginx" | crontab -
```

---

## 8. Maintenance

### Update Deployment

```bash
cd /opt/neo
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f mysql
```

### Database Backup

```bash
# Manual backup
docker compose -f docker-compose.prod.yml exec mysql \
  mysqldump -u neo -p neo > backup_$(date +%Y%m%d).sql

# Restore
docker compose -f docker-compose.prod.yml exec -i mysql \
  mysql -u neo -p neo < backup_20260411.sql
```

### Restart Services

```bash
# Restart everything
docker compose -f docker-compose.prod.yml restart

# Restart single service
docker compose -f docker-compose.prod.yml restart server
```

---

## 9. Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker compose -f docker-compose.prod.yml logs server --tail 50

# Common fix: rebuild
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Port already in use (local dev)

```bash
# Kill processes on port
neo stop
# Or manually:
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Database connection error

```bash
# Check MySQL is healthy
docker compose -f docker-compose.prod.yml ps mysql

# Check env variables
grep MYSQL /opt/neo/.env
```

### GitHub OAuth redirect error

Ensure your GitHub OAuth App settings match:
- **Homepage URL**: `https://li-neo.top` (or `http://localhost:3000` for dev)
- **Callback URL**: `https://li-neo.top/admin` (or `http://localhost:3000/admin` for dev)

And in `.env`:
```env
GITHUB_REDIRECT_URI=https://li-neo.top/admin
```

### AI Chat not working

Check OpenClaw configuration:
```bash
# Verify OpenClaw is running
curl http://127.0.0.1:18789/v1/models

# Check .env settings
grep OPENCLAW .env
```

---

## License

MIT
