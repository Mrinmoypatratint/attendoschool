#!/usr/bin/env bash
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config="${BACKUP_CONFIG_FILE:?Set BACKUP_CONFIG_FILE to your private chmod 600 backup env file}"
[[ -f "$config" && ! -L "$config" && "$(stat -c %a "$config")" == 600 ]] || { echo 'Backup config must be a real chmod 600 file' >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$config"
set +a
exec node "$root/scripts/backup/runner.cjs" daily
