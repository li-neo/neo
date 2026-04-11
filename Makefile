.PHONY: dev dev-server dev-web build up down restart logs db-migrate db-upgrade seed clean

# ---------- Development ----------
dev:
	@echo "Starting dev environment..."
	docker compose up -d mysql
	@sleep 3
	$(MAKE) dev-server & $(MAKE) dev-web

dev-server:
	cd server && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd apps/web && pnpm dev

# ---------- Docker ----------
build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

# ---------- Production ----------
deploy:
	./infra/scripts/deploy.sh

# ---------- Database ----------
db-migrate:
	cd server && uv run alembic revision --autogenerate -m "$(msg)"

db-upgrade:
	cd server && uv run alembic upgrade head

db-downgrade:
	cd server && uv run alembic downgrade -1

seed:
	cd server && uv run python -m scripts.seed

# ---------- Utility ----------
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .next -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
