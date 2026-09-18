# Production Deployment Runbook

## 1. Server
Recommended baseline:
- Linux LTS
- 2+ CPU
- 4+ GB RAM for initial deployment
- SSD storage sized for PostgreSQL + backups
- Firewall exposing only 80/443 and SSH from trusted sources

## 2. Secrets
Copy `.env.production.example` to `.env.production`.
Generate secrets using a secure password manager or:
`openssl rand -base64 64`
Never commit `.env.production`.

## 3. DNS/TLS
Point your domain to the server.
Install a trusted TLS certificate and mount the certificate/key through `deploy/nginx/certs/`.
Redirect HTTP to HTTPS in your final Nginx configuration.

## 4. Database
Use the PostgreSQL container for the initial deployment or an external managed PostgreSQL service.
Apply migrations in filename order.
Create a separate database role for the application with only required privileges.

## 5. Start
`docker compose -f docker-compose.production.yml up -d --build`

## 6. Verify
`docker compose -f docker-compose.production.yml ps`
`curl https://YOUR-DOMAIN/api/production-v26/health`
`curl https://YOUR-DOMAIN/api/production-v26/ready`

## 7. Workers
Run `node dist/workers/productionWorkerV26.js` on a trusted scheduler.
Recommended: once daily for subscriptions/communications/cleanup and a separate frequent backup schedule.

## 8. Backups
Use V21 backup functionality plus an off-server destination.
Keep multiple retention tiers and periodically restore into an isolated staging database.

## 9. Monitoring
Monitor:
- health/readiness
- HTTP 5xx rate
- PostgreSQL availability
- disk space
- backup success
- worker failures
- subscription/payment webhook failures
- notification provider failures

## 10. Launch gate
Do not launch until all critical checklist items are resolved and an end-to-end test passes for:
login → school setup → student (with student/parent email login setup) → teacher (with invite email) → password setup & reset → routine → attendance → correction → student portal → notification → subscription → payment → report → backup/restore.
