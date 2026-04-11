# P0: Project Scaffold

## Context
Neo is a personal workspace + portfolio + automation platform.
Backend: FastAPI + MySQL. Frontend: Next.js 15. Deploy: Docker → Volcengine ECS.

## Completed
- [x] Root config: .gitignore, .env.example, Makefile
- [x] FastAPI backend: core (config/db/security/response), models (7 tables), schemas, API v1 (8 modules), services (GitHub/HF/Skill)
- [x] Alembic migrations setup
- [x] Next.js 15 frontend: App Router, Tailwind CSS 4, Framer Motion, 6 pages
- [x] API client (lib/api.ts) with unified response handling
- [x] Docker Compose (MySQL + FastAPI + Next.js + Nginx)
- [x] Nginx reverse proxy config
- [x] Deploy script (SSH → Volcengine ECS)
- [x] Backup script (MySQL dump + gzip)
- [x] GitHub Actions CI/CD workflow
- [x] README documentation

## API Design
- Unified response: `{ code, message, data, meta }`
- Versioned: `/api/v1/...`
- Pre-registered integrations: GitHub, HuggingFace, OpenClaw, MCP
- MCP gateway: `/api/v1/mcp/tools` + `/api/v1/mcp/invoke`

## Next Steps (P1)
- [ ] Install frontend dependencies and verify build
- [ ] Run first Alembic migration
- [ ] Implement project list page with real API data
- [ ] Add GitHub repo auto-sync
- [ ] Add HuggingFace model/space display
