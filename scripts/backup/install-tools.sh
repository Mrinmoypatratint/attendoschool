#!/usr/bin/env bash
# Install signed distro client packages under the deployment user's private directory.
# No sudo, maintainer scripts, system package upgrades, or database server packages.
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
tool_home="${BACKUP_TOOL_HOME:-/home/attendoschool/.attendoschool-backup-state/tools}"
if [[ -f "$tool_home/runtime.env" ]]; then
  # shellcheck disable=SC1090
  source "$tool_home/runtime.env"
fi
metadata="$(node "$root/scripts/backup/provision.cjs" inspect)"
major="$(printf '%s' "$metadata" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const m=JSON.parse(s).postgresMajor;if(Number.isInteger(m)&&m>=14&&m<=30)process.stdout.write(String(m))})')"
packages=()
for pair in 'age:age' 'gh:gh' 'flock:util-linux'; do
  tool="${pair%%:*}"; package="${pair#*:}"
  command -v "$tool" >/dev/null || packages+=("$package")
done
if [[ -n "$major" && ! -x "/usr/lib/postgresql/$major/bin/pg_dump" && ! -x "$tool_home/prefix/usr/lib/postgresql/$major/bin/pg_dump" ]]; then packages+=("postgresql-client-$major"); fi
if [[ "${BACKUP_TOOLS_DRY_RUN:-false}" == true ]]; then
  printf 'DRY RUN: user-local packages: %s; detected database major: %s\n' "${packages[*]:-none}" "${major:-unconfirmed}"
  exit 0
fi
if [[ ${#packages[@]} -eq 0 ]]; then echo 'Backup tools already available.'; exit 0; fi
for required in apt-get apt-cache dpkg-deb curl; do command -v "$required" >/dev/null || { echo "Missing required package-download tool: $required" >&2; exit 1; }; done
mkdir -p "$tool_home/apt/lists/partial" "$tool_home/apt/cache/archives/partial" "$tool_home/packages" "$tool_home/prefix"
chmod 700 "$tool_home"
if [[ -f /etc/apt/sources.list ]]; then cp /etc/apt/sources.list "$tool_home/apt/sources.list"; else : > "$tool_home/apt/sources.list"; fi
options=(-o "Dir::State::lists=$tool_home/apt/lists" -o "Dir::Cache=$tool_home/apt/cache" -o "Dir::Etc::sourcelist=$tool_home/apt/sources.list" -o Dir::Etc::sourceparts=/etc/apt/sources.list.d -o Debug::NoLocking=1)
if [[ -n "$major" ]] && ! apt-cache show "postgresql-client-$major" >/dev/null 2>&1; then
  # Public signature key, not an encryption identity. Verify through apt's normal trust chain.
  curl -fsSL --retry 3 https://www.postgresql.org/media/keys/ACCC4CF8.asc -o "$tool_home/apt/postgresql.asc"
  codename="$(. /etc/os-release; printf '%s' "${VERSION_CODENAME:-}")"
  [[ "$codename" =~ ^[a-z]+$ ]] || { echo 'Cannot identify a supported apt distribution codename.' >&2; exit 1; }
  printf '\ndeb [signed-by=%s] https://apt.postgresql.org/pub/repos/apt %s-pgdg main\n' "$tool_home/apt/postgresql.asc" "$codename" >> "$tool_home/apt/sources.list"
fi
apt-get "${options[@]}" update
plan="$(apt-get "${options[@]}" --simulate --no-install-recommends install "${packages[@]}")"
mapfile -t download < <( { printf '%s\n' "${packages[@]}"; printf '%s\n' "$plan" | awk '/^Inst / {print $2}'; } | sort -u)
for package in "${download[@]}"; do
  [[ "$package" =~ ^[a-z0-9.+-]+(:[a-z0-9]+)?$ ]] || { echo 'Invalid package name in dependency plan.' >&2; exit 1; }
  [[ "$package" != libc6* ]] || { echo 'Client would require a different system C library; review compatibility.' >&2; exit 1; }
done
(cd "$tool_home/packages" && apt-get "${options[@]}" download "${download[@]}")
for deb in "$tool_home/packages"/*.deb; do [[ -f "$deb" ]] && dpkg-deb -x "$deb" "$tool_home/prefix"; done
case "$(uname -m)" in x86_64) multiarch=x86_64-linux-gnu ;; aarch64) multiarch=aarch64-linux-gnu ;; *) echo 'Unsupported client architecture.' >&2; exit 1 ;; esac
{
  printf 'export PATH=%q:%q:%q:%q:"$PATH"\n' "$tool_home/prefix/usr/lib/postgresql/${major:-unknown}/bin" "/usr/lib/postgresql/${major:-unknown}/bin" "$tool_home/prefix/usr/bin" "$tool_home/prefix/bin"
  printf 'export LD_LIBRARY_PATH=%q:%q${LD_LIBRARY_PATH:+:"$LD_LIBRARY_PATH"}\n' "$tool_home/prefix/usr/lib/$multiarch" "$tool_home/prefix/lib/$multiarch"
} > "$tool_home/runtime.env"
chmod 600 "$tool_home/runtime.env"
# shellcheck disable=SC1090
source "$tool_home/runtime.env"
age --version; gh --version | head -n 1
if [[ -n "$major" ]]; then pg_dump --version; pg_restore --version; fi
echo 'Backup client tools installed privately. System packages and database services were unchanged.'
