#!/usr/bin/env bash
# A disposable container only; never uses the application's real environment/database.
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
fixture="$(mktemp -d)"
container="attendo-backup-drill-$RANDOM-$$"
local_pg="${BACKUP_TEST_LOCAL_PG_BIN:-}"
cleanup() {
  if [[ -n "$local_pg" ]]; then "$local_pg/pg_ctl" -D "$fixture/cluster" -m immediate -w stop >/dev/null 2>&1 || true
  else docker rm -f "$container" >/dev/null 2>&1 || true; fi
  rm -rf -- "$fixture"
}
trap cleanup EXIT
mkdir "$fixture/bin"
if [[ -n "$local_pg" ]]; then
  export PATH="$local_pg:$PATH"
  mkdir "$fixture/socket"
  "$local_pg/initdb" -D "$fixture/cluster" -A trust -U postgres --no-locale >/dev/null
  "$local_pg/pg_ctl" -D "$fixture/cluster" -o "-k '$fixture/socket' -c listen_addresses=''" -l "$fixture/postgres.log" -w start >/dev/null
  export BACKUP_TEST_DB_HOST="$fixture/socket" PGHOST="$fixture/socket" PGUSER=postgres PGDATABASE=fixture
  createdb -U postgres fixture
  pg_cmd=()
else
  docker run -d --name "$container" -e POSTGRES_PASSWORD=fixture-db-password -e POSTGRES_DB=fixture -v "$fixture:$fixture" postgres:16-bookworm >/dev/null
  # The image starts a temporary Unix-socket server during initialization.
  # Only its final server accepts TCP, so do not use socket readiness here.
  for _ in {1..60}; do docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d fixture >/dev/null 2>&1 && break; sleep 1; done
  export BACKUP_TEST_DB_HOST=127.0.0.1
  pg_cmd=(docker exec "$container")
for tool in psql pg_dump pg_restore; do
  cat > "$fixture/bin/$tool" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
exec docker exec -u "$(id -u):$(id -g)" -e PGPASSWORD -e PGHOST -e PGUSER -e PGDATABASE "$BACKUP_TEST_CONTAINER" "$(basename "$0")" "$@"
SH
  chmod 700 "$fixture/bin/$tool"
done
fi
"${pg_cmd[@]}" psql -U postgres -d fixture -v ON_ERROR_STOP=1 -c "CREATE TABLE students(id int PRIMARY KEY, name text); INSERT INTO students VALUES (1,'Restore fixture');"
age-keygen -o "$fixture/throwaway.agekey"
export BACKUP_TEST_CONTAINER="$container" BACKUP_TEST_DIR="$fixture" BACKUP_TEST_ROOT="$root"
export PATH="$fixture/bin:$PATH"
export BACKUP_TEST_RECIPIENT
BACKUP_TEST_RECIPIENT="$(age-keygen -y "$fixture/throwaway.agekey")"
node <<'JS'
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { BackupManager } = require(path.join(process.env.BACKUP_TEST_ROOT, 'scripts/backup/core.cjs'));
const { restore } = require(path.join(process.env.BACKUP_TEST_ROOT, 'scripts/backup/restore.cjs'));
(async () => {
  const dir = process.env.BACKUP_TEST_DIR;
  const env = { PATH: process.env.PATH, NODE_ENV: 'test', DB_DRIVER: 'postgres', DB_HOST: process.env.BACKUP_TEST_DB_HOST, DB_USER: 'postgres', DB_NAME: 'fixture', DB_PASSWORD: 'fixture-db-password', BACKUP_TEST_CONTAINER: process.env.BACKUP_TEST_CONTAINER, BACKUP_FIREBASE_CONFIRMED_UNUSED: 'true', BACKUP_DIR: path.join(dir, 'backups'), BACKUP_AGE_RECIPIENT: process.env.BACKUP_TEST_RECIPIENT, BACKUP_STORAGE_DISABLED: 'true', BACKUP_UPLOAD_MAX_BYTES: '65536', BACKUP_MIN_FREE_BYTES: '1' };
  const manager = new BackupManager(env); const job = await manager.enqueue({ id: 'drill' });
  const done = await manager.run(job); assert.equal(done.status, 'ready', done.error);
  process.chdir(dir); const restored = await restore(['--file', path.join(manager.dir, done.fileName), path.join(dir, 'throwaway.agekey')], env);
  await fs.writeFile(path.join(dir, 'restored-path'), restored);
})().catch(e => { console.error(e); process.exitCode = 1; });
JS
restored="$(cat "$fixture/restored-path")"
"${pg_cmd[@]}" createdb -U postgres drill
"${pg_cmd[@]}" pg_restore -U postgres --exit-on-error --no-owner --no-privileges -d drill "$restored/database.dump"
actual="$("${pg_cmd[@]}" psql -U postgres -d drill -Atc 'SELECT name FROM students WHERE id=1')"
[[ "$actual" == 'Restore fixture' ]]
"${pg_cmd[@]}" pg_restore --list "$restored/database.dump" | grep 'TABLE public students'
echo 'PASS: real PostgreSQL dump -> age -> decrypt -> checksums -> isolated database restore -> original row verified.'
