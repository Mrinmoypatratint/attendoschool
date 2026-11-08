# The major must match the database server. Production Compose uses PostgreSQL 16.
ARG PG_MAJOR=16
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM postgres:${PG_MAJOR}-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends age gh ca-certificates libstdc++6 util-linux \
    && rm -rf /var/lib/apt/lists/*
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY scripts/backup ./scripts/backup
COPY .env.example .env.production.example docker-compose*.yml ecosystem.config.cjs ./
COPY backend/.env.example ./backend/.env.example
COPY frontend/.env.example frontend/.env.production.example ./frontend/
COPY deploy/nginx/nginx.conf ./deploy/nginx/nginx.conf
USER 1000:1000
ENTRYPOINT ["bash", "/app/scripts/backup/worker.sh"]
