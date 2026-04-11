#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# MySQL Backup Script
# Usage: ./infra/scripts/backup.sh
# ============================================================

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="neo_backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "==> Backing up MySQL database..."
docker compose exec mysql mysqldump -u"${MYSQL_USER:-neo}" -p"${MYSQL_PASSWORD:-change-me}" "${MYSQL_DATABASE:-neo}" > "${BACKUP_DIR}/${FILENAME}"

gzip "${BACKUP_DIR}/${FILENAME}"
echo "==> Backup saved to ${BACKUP_DIR}/${FILENAME}.gz"

# Keep only last 30 backups
ls -tp "${BACKUP_DIR}"/*.gz | tail -n +31 | xargs -I {} rm -- {} 2>/dev/null || true
echo "==> Cleanup done."
