#!/usr/bin/env bash
# Idempotent package preparation. Never upgrades the database server or application.
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
metadata="$(node "$root/scripts/backup/provision.cjs" inspect)"
major="$(printf '%s' "$metadata" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const m=JSON.parse(s).postgresMajor;if(Number.isInteger(m)&&m>=14&&m<=30)process.stdout.write(String(m))})')"
packages=()
for pair in 'age:age' 'gh:gh' 'flock:util-linux' 'crontab:cron'; do
  tool="${pair%%:*}"; package="${pair#*:}"
  command -v "$tool" >/dev/null || packages+=("$package")
done
if [[ -n "$major" && ! -x "/usr/lib/postgresql/$major/bin/pg_dump" ]]; then packages+=("postgresql-client-$major"); fi
if [[ "${BACKUP_TOOLS_DRY_RUN:-false}" == true ]]; then
  printf 'DRY RUN: required packages: %s; detected database major: %s\n' "${packages[*]:-none}" "${major:-unconfirmed}"
  exit 0
fi
if [[ ${#packages[@]} -eq 0 ]]; then echo 'Backup tools already available.'; exit 0; fi
command -v apt-get >/dev/null || { echo 'Backup setup requires a supported apt-based VPS; no packages were changed.' >&2; exit 1; }
privilege=()
if [[ "$(id -u)" != 0 ]]; then sudo -n true || { echo 'Installing missing backup tools requires noninteractive server administrator access.' >&2; exit 1; }; privilege=(sudo -n); fi
"${privilege[@]}" apt-get update
if [[ -n "$major" ]] && ! apt-cache show "postgresql-client-$major" >/dev/null 2>&1; then
  "${privilege[@]}" apt-get install -y --no-install-recommends postgresql-common ca-certificates
  [[ -x /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh ]] || { echo 'Official PostgreSQL repository helper is unavailable; client version needs review.' >&2; exit 1; }
  "${privilege[@]}" /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  "${privilege[@]}" apt-get update
fi
for package in "${packages[@]}"; do apt-cache show "$package" >/dev/null 2>&1 || { echo "Required package unavailable: $package" >&2; exit 1; }; done
"${privilege[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${packages[@]}"
echo 'Backup tools installed. No database server package was requested.'
