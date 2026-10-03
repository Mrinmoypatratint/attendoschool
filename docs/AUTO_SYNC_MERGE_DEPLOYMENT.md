# AttendoSchool — Automated Sync, Merge & Deployment Guide

Complete documentation for the production-grade CI/CD pipeline.

---

## Architecture Overview

```text
                  ┌──────────────────┐
                  │    Developer     │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Feature Branch   │
                  │ (Indranil,       │
                  │  sweta-mondal,   │
                  │  feature/*)      │
                  └────────┬─────────┘
                           │ git push
                           ▼
              ┌─────────────────────────┐
              │     CI Workflow         │
              │  (.github/workflows/   │
              │       ci.yml)          │
              │                         │
              │ ✓ Security scan        │
              │ ✓ Migration detection  │
              │ ✓ Backend TypeScript   │
              │ ✓ Backend 50 tests     │
              │ ✓ Frontend TypeScript  │
              │ ✓ Frontend Vite build  │
              │ ✓ Conflict detection   │
              │ ✓ Auto-PR creation     │
              └────────────┬────────────┘
                           │
                    ┌──────┴──────┐
                    │  CI PASS?   │
                    └──────┬──────┘
                     YES   │   NO
                           │    └──► BLOCKED (fix required)
                           ▼
                  ┌──────────────────┐
                  │ Pull Request     │
                  │ Auto-created     │
                  │ + Auto-merge     │
                  │   enabled        │
                  └────────┬─────────┘
                           │ merge
                           ▼
                     ┌───────────┐
                     │   main    │
                     └─────┬─────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    CD Workflow          │
              │  (.github/workflows/   │
              │      deploy.yml)       │
              │                         │
              │ ✓ Migration safety     │
              │ ✓ Build + test         │
              │ ✓ Save artifact        │
              │ ✓ FTPS deploy          │
              │ ✓ Health checks        │
              │ ✓ Auto-rollback        │
              └────────────┬────────────┘
                           │
                  ┌────────┴────────┐
                  │                 │
               Frontend          Backend
                  │                 │
                  ▼                 ▼
          ┌──────────────┐  ┌──────────────┐
          │  Hostinger   │  │   Render     │
          │  Premium     │  │   Cloud      │
          │  (FTPS)      │  │  (auto)      │
          └──────┬───────┘  └──────┬───────┘
                 │                 │
                 ▼                 ▼
          ┌──────────────┐  ┌──────────────┐
          │ Health Check │  │ Health Check │
          │ HTTP 200 +   │  │ /api/health  │
          │ content      │  │ HTTP 200     │
          └──────┬───────┘  └──────────────┘
                 │
          ┌──────┴──────┐
          │             │
        PASS          FAIL
          │             │
          ▼             ▼
       SUCCESS     AUTO ROLLBACK
                   (prev artifact)
```

---

## 1. How Automatic Pull/Fetch Works

The system uses `git fetch origin` (not `git pull`) to safely retrieve remote state without modifying the local working tree.

**CI Workflow** (`ci.yml`):
- Runs `git fetch origin` with `fetch-depth: 0` (full history)
- Compares branch HEAD vs `origin/main` using `git rev-list --left-right --count`
- Reports: commits ahead, commits behind, changed files

**Sync Workflow** (`sync.yml`):
- Runs `git fetch origin --prune` every 6 hours (or on-demand)
- Iterates all remote branches
- Generates comparison report without modifying any branch

---

## 2. How Comparison Works

Before any merge attempt, the CI generates a full comparison report:

```text
LOCAL COMMIT:    abc1234 (source branch HEAD)
REMOTE COMMIT:   def5678 (origin/main HEAD)

COMMITS AHEAD:   3
COMMITS BEHIND:  1

FILES CHANGED:   (via git diff --stat)
```

The comparison is visible in the GitHub Actions **Step Summary** tab for every CI run.

---

## 3. How Conflicts Are Detected

The CI performs a **safe dry-run merge** on a temporary detached HEAD:

```bash
git checkout --detach origin/main
git merge --no-commit --no-ff origin/<branch>
```

- If the merge succeeds → **No conflicts** → PR is created/updated
- If the merge fails → **Conflicts detected** → PR creation is blocked

Conflict report includes:
- Conflicting file paths
- Recommended action (merge main into branch locally, resolve, push)

**The CI never modifies `main` or the developer's branch.**

---

## 4. How CI Works

**Trigger:** Every push to any branch except `main` and `gh-pages`, and all PRs to `main`.

**Stages:**
1. **Pre-Flight Checks**
   - Commit integrity verification
   - Secret leak detection (scans diff for passwords, API keys, private keys)
   - Database migration detection (checks `database/` directory changes)
   - Destructive migration detection (`DROP TABLE`, `TRUNCATE`, etc.)
2. **Backend CI**
   - `npm install` → `npm run build` (TypeScript compile)
   - `npm run test` (50-test comprehensive suite)
3. **Frontend CI**
   - `npm ci` → `npx tsc --noEmit` (strict TypeScript check)
   - `npm run build` (Vite production bundle)
4. **Conflict Detection & Auto-PR**
   - Safe merge dry-run
   - Auto-creates Pull Request if clean
   - Enables GitHub auto-merge if no destructive migrations

---

## 5. How Auto-Merge Works

Auto-merge follows a **controlled flow**, never a blind merge:

```text
AUTO MERGE ALLOWED IF:
  ✓ CI = PASS (all backend + frontend checks)
  ✓ BUILD = PASS
  ✓ TESTS = PASS (50/50)
  ✓ SECURITY = PASS (no leaked secrets)
  ✓ CONFLICT = NONE (verified by dry-run)
  ✓ DESTRUCTIVE MIGRATION = NONE
  ✓ Pull Request exists

AUTO MERGE BLOCKED IF:
  ✗ Any CI check fails
  ✗ Merge conflicts exist
  ✗ Destructive database migration detected
  ✗ Security scan finds leaked secrets
```

The system uses GitHub's native `gh pr merge --auto --merge` mechanism, which respects branch protection rules.

**Never used:**
- `git push --force`
- `git reset --hard origin/main`
- Direct push to main from CI (bypassing PRs)

---

## 6. When Auto-Merge Is Blocked

| Condition | Action |
| :--- | :--- |
| CI tests fail | Fix code, push again |
| Merge conflicts | Merge `main` into your branch locally, resolve conflicts, push |
| Destructive migration detected | Manual review and approval required |
| Leaked secret detected | Remove secret from code, rotate exposed credentials |
| Branch protection requires review | Wait for reviewer approval |

---

## 7. How Deployment Starts

Deployment triggers **only on push to `main`** (typically after PR merge):

```yaml
on:
  push:
    branches: [main]
```

**Deployment Lock:** Only one deployment can run at a time:
```yaml
concurrency:
  group: production-deployment
  cancel-in-progress: false
```

---

## 8. How FTP/FTPS Deployment Works

**Frontend → Hostinger Premium (FTPS)**

```text
Build Artifact (frontend/dist/)
        ↓
  Upload via FTPS (TLS encrypted)
        ↓
  Hostinger shared hosting
        ↓
  https://attendoschool.optinetinnovations.in
```

The deploy script (`scripts/deploy-hostinger.js`) connects via FTPS to the Hostinger FTP server and uploads the Vite build output.

**Backend → Render Cloud**

Render automatically deploys when `main` is updated (Git integration). Optionally triggered via webhook (`RENDER_DEPLOY_HOOK_URL`).

---

## 9. How Secrets Are Stored

All credentials are stored as **GitHub Actions Repository Secrets** (encrypted at rest):

| Secret | Purpose |
| :--- | :--- |
| `HOSTINGER_FTP_SERVER` | FTP hostname/IP |
| `HOSTINGER_FTP_USERNAME` | FTP username |
| `HOSTINGER_FTP_PASSWORD` | FTP password |
| `HOSTINGER_SERVER_DIR` | Remote directory |
| `VITE_API_URL` | Backend API URL |
| `RENDER_DEPLOY_HOOK_URL` | Backend deploy webhook (optional) |

Secrets are:
- Never printed in logs (GitHub auto-masks them)
- Never committed to the repository
- Never exposed to PR workflows from forks

---

## 10. How Production Is Verified

After deployment, automated health checks run:

**Frontend Health Check:**
1. HTTP GET `https://attendoschool.optinetinnovations.in`
2. Verify HTTP 200 response
3. Verify response contains expected app content (`root`, `attendoschool`)
4. Retry up to 5 times with 10s intervals

**Backend Health Check:**
1. HTTP GET `https://attendoschool-backend.onrender.com/api/health`
2. Verify HTTP 200 response
3. Retry up to 5 times with 30s intervals (Render free tier wake-up)

---

## 11. How Rollback Works

If the frontend health check fails after deployment:

1. The rollback job activates automatically
2. Searches for the previous successful deployment artifact (saved for 30 days)
3. Downloads the previous `frontend/dist/` build
4. Re-deploys it to Hostinger via FTPS
5. Reports rollback status

**Limitations:**
- Rollback is available for frontend only (Render manages backend rollbacks)
- Requires at least one previous successful deployment artifact
- If no previous artifact exists, manual intervention is required

---

## 12. How to Manually Stop Automation

### Disable Specific Workflow
1. Go to **GitHub → Actions → Select workflow**
2. Click **⋯ → Disable workflow**

### Emergency: Remove Deployment Credentials
1. Go to **GitHub → Settings → Secrets and variables → Actions**
2. Delete or update `HOSTINGER_FTP_PASSWORD`
3. Deployments will fail safely (no data loss)

### Block Production Branch
1. Go to **GitHub → Settings → Branches → Branch protection rules**
2. Lock the `main` branch

**Never delete deployment history** — it's needed for auditing and rollback.

---

## 13. How to Manually Deploy

### Via GitHub Actions UI
1. Go to **GitHub → Actions → CD — Production Deployment**
2. Click **Run workflow**
3. Select `main` branch
4. Optionally enter a `rollback_run_id` to restore a previous version
5. Click **Run workflow**

### Emergency Deploy (skip tests)
1. Same as above, but check **Skip tests**
2. Only use in genuine emergencies

---

## 14. How to Troubleshoot Failures

### CI Failure
1. Open the failed GitHub Actions run
2. Check the **Step Summary** tab for a human-readable report
3. Click the failed job to see detailed logs
4. Fix the issue in your branch and push again

### Deployment Failure
1. Check the **CD — Production Deployment** run logs
2. Common issues:
   - FTP credentials expired → Update `HOSTINGER_FTP_PASSWORD` secret
   - Network timeout → Re-run the workflow
   - Build failure → Fix code and push to main

### Health Check Failure
1. Manually visit `https://attendoschool.optinetinnovations.in`
2. Check browser console for errors
3. Check backend: `https://attendoschool-backend.onrender.com/api/health`
4. If rollback was triggered, check the rollback job logs

---

## Workflow Files Reference

| File | Purpose | Trigger |
| :--- | :--- | :--- |
| `.github/workflows/ci.yml` | Lint, Test, Build, Security, Auto-PR | Branch push, PR |
| `.github/workflows/deploy.yml` | Build, Deploy, Health Check, Rollback | Main push, Manual |
| `.github/workflows/sync.yml` | Branch comparison & conflict report | Every 6h, Manual |
| `.github/workflows/keep-alive.yml` | Render backend keep-alive ping | Every 10min |

---

## Security Principles

- **Least-privilege permissions** — CI has `read` only; deploy has `read` + `deployments: write`
- **No `write-all`** — Each workflow declares minimum required permissions
- **No force push** — `git push --force` is never used
- **No blind overwrite** — Production is never blindly replaced without health verification
- **Secrets protected** — Never printed, never committed, never exposed to fork PRs
- **Branch protection** — Auto-merge respects GitHub branch protection rules
- **Deployment lock** — `concurrency: production-deployment` prevents race conditions
- **Migration safety** — Destructive database operations block automatic deployment
