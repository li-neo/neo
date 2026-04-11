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
| Frontend   | Next.js 15, React 19, Tailwind CSS 4, Framer Motion |
| Backend    | FastAPI, SQLAlchemy 2.0, Pydantic 2      |
| Database   | MySQL 8.0                                |
| Auth       | GitHub OAuth + JWT                       |
| Deploy     | Docker Compose → Volcengine ECS          |
| CI/CD      | GitHub Actions                           |
| Reverse Proxy | Nginx                                 |

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

| Module        | Prefix                  | Description                     |
|---------------|-------------------------|---------------------------------|
| Auth          | `/api/v1/auth`          | GitHub OAuth login, JWT         |
| Projects      | `/api/v1/projects`      | CRUD for project showcase       |
| Posts         | `/api/v1/posts`         | Blog posts                      |
| Skills        | `/api/v1/skills`        | Skill management & publishing   |
| Guestbook     | `/api/v1/guestbook`     | Public guestbook                |
| Workspace     | `/api/v1/workspace`     | Dashboard & task automation     |
| Integrations  | `/api/v1/integrations`  | GitHub / HuggingFace / OpenClaw |
| MCP           | `/api/v1/mcp`           | Model Context Protocol gateway  |

## Quick Start

```bash
# 1. Copy environment variables
cp .env.example .env
# Edit .env with your values

# 2. Start MySQL
docker compose up -d mysql

# 3. Start backend
cd server && uv run uvicorn app.main:app --reload --port 8000

# 4. Start frontend
cd apps/web && pnpm install && pnpm dev

# Or start everything with Docker:
docker compose up -d
```

## Deploy (Volcengine)

```bash
# Set secrets in GitHub repo settings:
# DEPLOY_HOST, DEPLOY_USER, SSH_PRIVATE_KEY

# Push to main triggers automatic deployment
git push origin main

# Or manual deploy:
make deploy
```

## Development Commands

```bash
make dev           # Start dev environment
make build         # Build Docker images
make up            # Start all containers
make down          # Stop all containers
make db-migrate    # Create migration: make db-migrate msg="add users table"
make db-upgrade    # Apply migrations
make seed          # Seed sample data
```
