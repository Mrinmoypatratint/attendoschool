#!/usr/bin/env bash
# Exercise non-root installation without apt changes or network access.
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT
mkdir "$fixture/bin"
export BACKUP_TEST_REAL_NODE
BACKUP_TEST_REAL_NODE="$(command -v node)"
export BACKUP_TEST_INSTALL_LOG="$fixture/operations.log"
cat > "$fixture/bin/node" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == *provision.cjs ]]; then printf '{"postgresMajor":27}\n'; else exec "$BACKUP_TEST_REAL_NODE" "$@"; fi
SH
cat > "$fixture/bin/apt-cache" <<'SH'
#!/usr/bin/env bash
printf 'Package: synthetic-test-client\n'
SH
cat > "$fixture/bin/apt-get" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$BACKUP_TEST_INSTALL_LOG"
case " $* " in
  *' --simulate '*) printf 'Inst postgresql-client-27 (synthetic)\n' ;;
  *' download '*) : > synthetic-client.deb ;;
  *' update '*) : ;;
  *) echo 'Unexpected apt mutation' >&2; exit 1 ;;
esac
SH
cat > "$fixture/bin/dpkg-deb" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == '-x' ]]
prefix="$3"
mkdir -p "$prefix/usr/bin" "$prefix/usr/lib/postgresql/27/bin"
for tool in age gh; do printf '#!/usr/bin/env bash\necho synthetic-test-version\n' > "$prefix/usr/bin/$tool"; chmod 700 "$prefix/usr/bin/$tool"; done
for tool in pg_dump pg_restore; do printf '#!/usr/bin/env bash\necho synthetic-PostgreSQL-27\n' > "$prefix/usr/lib/postgresql/27/bin/$tool"; chmod 700 "$prefix/usr/lib/postgresql/27/bin/$tool"; done
SH
chmod 700 "$fixture/bin/"*
PATH="$fixture/bin:$PATH" BACKUP_TOOL_HOME="$fixture/tools" bash "$root/scripts/backup/install-tools.sh" > "$fixture/install.log"
test -f "$fixture/tools/runtime.env"
grep -q 'System packages and database services were unchanged' "$fixture/install.log"
grep -q -- '--simulate' "$BACKUP_TEST_INSTALL_LOG"
grep -q 'download' "$BACKUP_TEST_INSTALL_LOG"
if grep -qE 'sudo|apt-get install' "$BACKUP_TEST_INSTALL_LOG"; then echo 'FAIL: attempted privileged package installation'; exit 1; fi
echo 'PASS: private tool installation downloads/extracts packages without sudo, maintainer scripts or system package changes.'
