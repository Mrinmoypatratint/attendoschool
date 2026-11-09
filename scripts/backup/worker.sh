#!/usr/bin/env bash
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -n "${BACKUP_CONFIG_FILE:-}" ]]; then
  [[ -f "$BACKUP_CONFIG_FILE" && ! -L "$BACKUP_CONFIG_FILE" && "$(stat -c %a "$BACKUP_CONFIG_FILE")" == 600 ]] || { echo 'Backup config must be a real chmod 600 file' >&2; exit 1; }
  set -a
  # shellcheck disable=SC1090
  source "$BACKUP_CONFIG_FILE"
  set +a
fi
mkdir -p -- "${BACKUP_DIR:-$root/backups/private}"
exec flock --no-fork -n "${BACKUP_DIR:-$root/backups/private}/worker.flock" node "$root/scripts/backup/worker.cjs"
