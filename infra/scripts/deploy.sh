#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Neo Deployment Script — Volcengine ECS
# Usage: ./infra/scripts/deploy.sh
# ============================================================

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST in .env}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_KEY="${DEPLOY_KEY_PATH:-~/.ssh/id_rsa}"
PROJECT_DIR="/opt/neo"

echo "==> Deploying Neo to ${DEPLOY_USER}@${DEPLOY_HOST}..."

ssh -i "$DEPLOY_KEY" "${DEPLOY_USER}@${DEPLOY_HOST}" << 'REMOTE'
set -euo pipefail

PROJECT_DIR="/opt/neo"

# Install Docker if not present
if ! command -v docker &>/dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

# Install Docker Compose plugin if not present
if ! docker compose version &>/dev/null; then
    echo "Installing Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# Clone or pull
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    git pull origin main
else
    git clone "${GIT_REPO_URL:-https://github.com/YOUR_USER/neo.git}" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# Copy .env if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo "WARNING: .env created from example — please edit it with real values!"
fi

# Build and deploy
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d

# Run migrations
docker compose exec server uv run alembic upgrade head

echo "==> Deployment complete!"
docker compose ps
REMOTE

echo "==> Done."
