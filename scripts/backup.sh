#!/bin/sh
set -eu
mkdir -p "${BACKUP_DIR:-./backups}"
pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-attendance}" -F p > "${BACKUP_DIR}/attendance_$(date +%Y%m%d_%H%M%S).sql"
echo "Backup created."
