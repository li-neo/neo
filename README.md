# Neo

Personal workspace, portfolio & automation platform.

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

| Layer      | Technology                               |
|------------|------------------------------------------|
| Frontend   | Next.js 15, React 19, Tailwind CSS 4, Framer Motion, Three.js |
| Backend    | FastAPI, SQLAlchemy 2.0, Pydantic 2      |
| Database   | SQLite (dev) / MySQL 8.0 (prod)          |
| Auth       | GitHub OAuth + JWT                       |
| Deploy     | Docker Compose → Volcengine ECS          |
| CI/CD      | GitHub Actions                           |
| Reverse Proxy | Nginx                                 |

---

## Prerequisites

| Tool | Install |
|------|---------|
| Python 3.11+ | `brew install python@3.12` |
| uv (Python pkg manager) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js 20+ | `brew install node` |
| pnpm | `npm install -g pnpm` |

---

## Quick Start (Local Development)

### 1. Clone & Install

```bash
git clone <repo-url> && cd neo

# Install backend dependencies
cd server && uv sync && cd ..

# Install frontend dependencies
cd apps/web && pnpm install && cd ../..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
# Required: GitHub OAuth (https://github.com/settings/developers → New OAuth App)
#   Homepage URL: http://localhost:3000
#   Callback URL: http://localhost:3000/admin
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/admin

# Required: Your GitHub email → auto-gets admin role
ADMIN_GITHUB_USERS=your-github-email@example.com
```

### 3. Start Services

```bash
# Start both backend + frontend (SQLite, no Docker needed)
make dev-local
```

Or start them separately in two terminals:

```bash
# Terminal 1: Backend (http://localhost:8000)
make dev-server

# Terminal 2: Frontend (http://localhost:3000)
make dev-web
```

### 4. Seed Sample Data (optional)

```bash
make seed
```

### 5. Open Browser

| Page | URL |
|------|-----|
| Homepage | http://localhost:3000 |
| Admin Dashboard | http://localhost:3000/admin |
| API Docs (Swagger) | http://localhost:8000/docs |
| Health Check | http://localhost:8000/health |

---

## Service Management

### Start

```bash
# Local dev (SQLite, recommended for development)
make dev-local

# Or with Docker MySQL
make dev

# Or Docker full stack (backend + frontend + MySQL + Nginx)
make up
```

### Stop

```bash
# If started via make dev-local or make dev-server / dev-web:
# Press Ctrl+C in each terminal, or kill by port:
kill $(lsof -t -i:8000)   # Stop backend
kill $(lsof -t -i:3000)   # Stop frontend

# If started via Docker:
make down
```

### Restart

```bash
# Backend only (auto-reload on file save, usually no manual restart needed)
# If needed, force restart:
kill $(lsof -t -i:8000) && make dev-server

# Frontend only
kill $(lsof -t -i:3000) && make dev-web

# Docker
make restart
```

### View Logs

```bash
# Docker logs
make logs
```

---

## Admin Dashboard

### Login Flow

1. Visit http://localhost:3000/admin
2. Click **Sign in with GitHub**
3. Authorize on GitHub → redirect back
4. If your GitHub email matches `ADMIN_GITHUB_USERS` in `.env`, you get admin access

### Features

| Tab | Operations |
|-----|-----------|
| Projects | Create, edit, delete projects |
| Skills | Create, edit, delete skills |
| Guestbook | View, delete messages |
| Uploads | Upload images & videos |

### Admin Access Control

Only users whose GitHub username **or** email matches `ADMIN_GITHUB_USERS` in `.env` get the `admin` role. All other GitHub users get `user` role and are denied access to the admin page.

---

## Database

### Local Dev (SQLite)

Database file: `server/neo.db` (auto-created on first startup).

```bash
# Reset database
rm server/neo.db && make seed

# Seed sample data
make seed
```

### Production (MySQL via Docker)

```bash
# Start MySQL only
docker compose up -d mysql

# Run migrations
make db-upgrade

# Create new migration
make db-migrate msg="add users table"

# Rollback one migration
make db-downgrade
```

To switch between SQLite and MySQL, edit `.env`:

```env
# SQLite (local dev):
DATABASE_URL_OVERRIDE=sqlite:///./neo.db

# MySQL (production): comment out the above and set:
# MYSQL_HOST=mysql
# MYSQL_PORT=3306
# MYSQL_USER=neo
# MYSQL_PASSWORD=your-password
# MYSQL_DATABASE=neo
```

---

## API Endpoints

All APIs follow a unified response format:

```json
{
  "code": 0,
  "message": "ok",
  "data": { },
  "meta": { "pagination": { "page": 1, "page_size": 20, "total": 100 } }
}
```

| Module        | Prefix                  | Auth     | Description                     |
|---------------|-------------------------|----------|---------------------------------|
| Auth          | `/api/v1/auth`          | -        | GitHub OAuth login, JWT         |
| Projects      | `/api/v1/projects`      | Admin (CUD) | CRUD for project showcase    |
| Posts         | `/api/v1/posts`         | Admin (CUD) | Blog posts                   |
| Skills        | `/api/v1/skills`        | Admin (CUD) | Skill management & publishing|
| Guestbook     | `/api/v1/guestbook`     | Admin (D)   | Public guestbook             |
| Uploads       | `/api/v1/uploads`       | Admin    | Image & video uploads           |
| Workspace     | `/api/v1/workspace`     | User     | Dashboard & task automation     |
| Integrations  | `/api/v1/integrations`  | User     | GitHub / HuggingFace / OpenClaw |
| MCP           | `/api/v1/mcp`           | User     | Model Context Protocol gateway  |

---

## Deploy (Volcengine)

```bash
# Set secrets in GitHub repo settings:
# DEPLOY_HOST, DEPLOY_USER, SSH_PRIVATE_KEY

# Push to main triggers automatic deployment
git push origin main

# Or manual deploy:
make deploy
```

---

## All Make Commands

```bash
make dev-local     # Start backend + frontend (SQLite, no Docker)
make dev           # Start backend + frontend (Docker MySQL)
make dev-server    # Start backend only
make dev-web       # Start frontend only
make build         # Build Docker images
make up            # Start all Docker containers
make down          # Stop all Docker containers
make restart       # Restart Docker containers
make logs          # View Docker logs
make seed          # Seed sample data
make db-migrate    # Create migration: make db-migrate msg="description"
make db-upgrade    # Apply migrations
make db-downgrade  # Rollback one migration
make deploy        # Deploy to production
make clean         # Remove __pycache__, .next, node_modules
```
