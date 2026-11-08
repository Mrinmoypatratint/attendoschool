#!/usr/bin/env bash
# Integration of real entrypoints, process queue, GNU tools, age and restore.
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
fixture="$(mktemp -d)"
worker_pid=''
cleanup() {
  if [[ -n "$worker_pid" ]]; then kill "$worker_pid" 2>/dev/null || true; wait "$worker_pid" 2>/dev/null || true; fi
  rm -rf -- "$fixture"
}
trap cleanup EXIT
mkdir -p "$fixture/bin" "$fixture/releases" "$fixture/uploads"
printf 'uploaded fixture file\n' > "$fixture/uploads/example.txt"
age-keygen -o "$fixture/throwaway.agekey"
recipient="$(age-keygen -y "$fixture/throwaway.agekey")"
for tool in psql pg_dump pg_restore gh; do
  cat > "$fixture/bin/$tool" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
exec node "$BACKUP_TEST_FAKE" "$(basename "$0")" "$@"
SH
  chmod 700 "$fixture/bin/$tool"
done
# Trusted test config, not sourced application .env. All data and keys are synthetic.
cat > "$fixture/backup.env" <<EOF
NODE_ENV=test
DB_DRIVER=postgres
DB_PASSWORD=fixture-db-password
DATABASE_URL=''
SUPABASE_DATABASE_URL=''
FIREBASE_STORAGE_BUCKET=''
GCS_BUCKET=''
ENABLE_DUAL_DB_SYNC=false
SECONDARY_DB=none
BACKUP_FIREBASE_CONFIRMED_UNUSED=true
BACKUP_DIR='$fixture/private'
BACKUP_UPLOAD_DIR='$fixture/uploads'
BACKUP_STORAGE_DISABLED=true
SUPABASE_URL=''
SUPABASE_SERVICE_ROLE_KEY=''
BACKUP_AGE_RECIPIENT='$recipient'
BACKUP_GITHUB_REPO=fixture/private-backups
BACKUP_GH_TOKEN=fixture-token
BACKUP_SPLIT_BYTES=4096
BACKUP_UPLOAD_MAX_BYTES=65536
BACKUP_MIN_FREE_BYTES=1
BACKUP_TEST_RELEASES='$fixture/releases'
BACKUP_TEST_FAKE='$root/scripts/backup/tests/fake-tools.cjs'
JWT_SECRET=fixture-known-secret-79b
PATH='$fixture/bin:$PATH'
EOF
chmod 600 "$fixture/backup.env"
printf "BACKUP_AGE_RECIPIENT=''\nBACKUP_GH_TOKEN=''\n" > "$fixture/paused.env"
chmod 600 "$fixture/paused.env"
BACKUP_CONFIG_FILE="$fixture/paused.env" bash "$root/scripts/backup/scheduled.sh" > "$fixture/paused.log"
grep -q 'PAUSED' "$fixture/paused.log"
NODE_ENV=test BACKUP_TOOLS_DRY_RUN=true DATABASE_URL='' SUPABASE_DATABASE_URL='' DB_HOST='' \
  bash "$root/scripts/backup/install-tools.sh" > "$fixture/tools.log"
grep -q 'DRY RUN' "$fixture/tools.log"
export BACKUP_CONFIG_FILE="$fixture/backup.env"
bash "$root/scripts/backup/worker.sh" > "$fixture/worker.log" 2>&1 &
worker_pid=$!
for _ in {1..40}; do [[ -f "$fixture/private/worker.flock" ]] && break; sleep 0.1; done
# A chmod violation must fail before a job is enqueued.
chmod 644 "$fixture/backup.env"
if bash "$root/scripts/backup.sh" > /dev/null 2>&1; then echo 'FAIL: accepted insecure config'; exit 1; fi
chmod 600 "$fixture/backup.env"
timeout 60 bash "$root/scripts/backup.sh"
release="$(find "$fixture/releases" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[[ -n "$release" && "$(find "$release" -type f | wc -l)" -gt 1 ]]
if grep -a -l -E 'PGDMP|fixture-known-secret-79b' "$release"/*; then echo 'FAIL: plaintext release'; exit 1; fi
set -a
# shellcheck disable=SC1090
source "$fixture/backup.env"
set +a
cd "$fixture"
bash "$root/scripts/restore.sh" fixture/private-backups "$fixture/throwaway.agekey" "$(basename "$release")"
restored="$(find "$fixture" -type d -name extracted | head -n 1)"
(cd "$restored" && sha256sum -c SHA256SUMS && pg_restore --list database.dump | grep 'TABLE public students')
mkdir "$fixture/restored-uploads" "$fixture/restored-config"
tar -xf "$restored/uploads.tar" -C "$fixture/restored-uploads"
tar -xf "$restored/config.tar" -C "$fixture/restored-config"
cmp "$fixture/uploads/example.txt" "$fixture/restored-uploads/local/example.txt"
grep -q 'fixture-known-secret-79b' "$fixture/restored-config/runtime.env"
[[ ! -e "$fixture/restored-config/backup.env" && ! -d "$fixture/restored-config/node_modules" ]]
# Worker is isolated from application/notification workers. Failed jobs release the lock.
kill "$worker_pid"; wait "$worker_pid" || true; worker_pid=''
echo 'PASS: shell entrypoints -> dedicated worker -> synthetic dump -> real age -> split fake release -> decrypt -> checksums -> identical uploads.'
