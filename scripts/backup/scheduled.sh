#!/usr/bin/env bash
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
config="${BACKUP_CONFIG_FILE:?Set BACKUP_CONFIG_FILE}"
[[ -f "$config" && ! -L "$config" && "$(stat -c %a "$config")" == 600 ]] || { echo 'Backup config must be a real chmod 600 file' >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$config"
set +a
if [[ -z "${BACKUP_AGE_RECIPIENT:-}" || -z "${BACKUP_GH_TOKEN:-}" ]]; then
  printf '%s PAUSED: daily off-server backups require a public age recipient and a backup-repo-only token. No backup was uploaded.\n' "$(date -u +%FT%TZ)"
  exit 0
fi
exec node "$root/scripts/backup/runner.cjs" daily
