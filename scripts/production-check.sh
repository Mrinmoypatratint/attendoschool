#!/bin/sh
set -eu
echo "Production checklist"
command -v docker >/dev/null && echo "[OK] docker" || echo "[WARN] docker missing"
command -v openssl >/dev/null && echo "[OK] openssl" || echo "[WARN] openssl missing"
test -f .env.production && echo "[OK] .env.production" || echo "[WARN] create .env.production"
echo "Run: docker compose -f docker-compose.production.yml config"
