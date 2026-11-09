# RBAC & Feature Control — Rollout Guide

Audience: the AttendoSchool owner / operator deploying the RBAC feature-control change.

## What ships

| Piece | Where |
| --- | --- |
| Catalog (features, permissions, route bindings) | `backend/src/rbac/catalog.ts` |
| Decision engine + cached snapshot + writes | `backend/src/rbac/accessService.ts` |
| Storage (SQL; 503 when unavailable) | `backend/src/rbac/accessStore.ts`, `principalDirectory.ts` |
| Gate / account-status / login gate | `backend/src/rbac/middleware.ts` (mounted in `app.ts`, called from `middleware/auth.ts`, `routes/auth.ts`) |
| School API | `GET/PUT /api/access/*` (`backend/src/routes/access.ts`) |
| Super-admin API | `/api/super-admin/features/*` (`backend/src/routes/superAdminFeatures.ts`) |
| Migration | `database/migrations/051_rbac_feature_control.sql` |
| School UI | `/#/permissions` → `frontend/src/pages/admin/access/AccessControl.tsx` |
| Super-admin UI | `/#/super-admin/permissions` → `frontend/src/super-admin/FeatureManagement.tsx` |

Nothing changes for any user until (a) the migration is applied, (b) someone flips a toggle, and
(c) `RBAC_ENFORCEMENT=enforce`. With empty tables every role has exactly today's access (proven by
`backend/tests/rbac-baseline.test.ts` in all three modes).

## 1. Deploy the code (default mode = shadow)

`RBAC_ENFORCEMENT` defaults to `shadow` when unset. Shadow computes every decision, never blocks, and
logs any would-be denial. Deploying without the migration is safe: the app logs one warning
`[RBAC] RBAC tables are not installed …`, serves legacy behaviour, `/api/health` shows
`"rbac": "NOT_INSTALLED"`, and RBAC write endpoints return `503 ACCESS_STORE_UNAVAILABLE`.

## 2. Apply the migration (manual — the deploy workflow does NOT run migrations)

On the server, against the production database, after a backup:

```bash
cd /home/attendoschool/htdocs/attendoschool.online
npm --prefix backend run backup:postgres        # take a backup first
npm --prefix backend run build
npm --prefix backend run db:migrate             # applies 051_rbac_feature_control.sql only (others already recorded)
curl -s https://attendoschool.online/api/health  # expect "rbac": "READY"
```

Migration 051 is additive (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING/UPDATE`), creates no
foreign keys to users/schools, seeds every existing plan × feature = enabled, and registers the catalog
keys in `permission_definitions` (legacy keys untouched). Verified against a disposable PostgreSQL 16
(PGlite) including an idempotent re-run.

## 3. Shadow period (recommended ≥ 1 week)

Admins can already use the UI; changes are saved and audited, and the pages show a "not yet enforced" banner.
Read the shadow log:

```bash
pm2 logs --lines 5000 | grep '\[RBAC_SHADOW\]'
```

Each line is one JSON object, ids only (no names/e-mails/tokens):

```
[RBAC_SHADOW] {"wouldDeny":true,"reason":"ROLE_DENY","permission":"assignments.view","feature":"assignments","method":"GET","path":"/api/teacher/assignments","uid":"…","role":"TEACHER","school":"…"}
```

| reason | meaning | action |
| --- | --- | --- |
| `ROLE_DENY` / `USER_DENY` | an admin turned it off — this is the intended effect | none |
| `FEATURE_DISABLED` | plan / school / global switch is off | confirm with the school |
| `ACCOUNT_DISABLED` | a disabled user is still active | expected after enforce they are signed out |
| `[RBAC_UNBOUND]` | an /api path has no catalog binding | add a binding in `catalog.ts` + rerun the route-map generator |
| `[RBAC_SHADOW_ERROR]` | store error | investigate DB health before enforcing |

Any `ROLE_DENY`/`FEATURE_DISABLED` you did NOT expect means a toggle was set that would break someone — fix the toggle before enforcing.

## 4. Switch to enforce

Set `RBAC_ENFORCEMENT=enforce` in the backend environment and `pm2 reload`. From then on:
`403 {code: FEATURE_DISABLED | PERMISSION_DENIED}`, `401 {code: ACCOUNT_DISABLED}`; store errors fail closed
with `503 ACCESS_UNAVAILABLE`. The UI hides denied navigation/buttons and shows "Access restricted" pages
(the UI only hides things in enforce mode).

## 5. Rollback

Immediate, no deploy: set `RBAC_ENFORCEMENT=off` and `pm2 reload` → no RBAC evaluation at all, legacy behaviour.
The tables can stay; they are ignored. Data is never deleted by a feature switch, so turning things back on restores access.

## Staleness (how fast a change applies)

| Change | Same process | Other processes / cluster workers |
| --- | --- | --- |
| Role/person permission, school feature | next request | ≤ 60 s (snapshot TTL) |
| Login disable | next request | ≤ 30 s (login TTL) |
| Plan / global switch | next request | ≤ 60 s |

`utils/cache.ts` keeps a per-process L1 copy even when Redis is configured, so the worst case above holds
with or without Redis. Existing tokens of disabled users are rejected within that window (JWTs remain valid
for 30 days otherwise — see known issues).

## Known issues found during the audit (not fixed — need owner decision)

These are legacy behaviours kept for backward compatibility (R1). Each is a separately toggleable permission,
so a school admin can already switch them off per role:

1. ~~Login demo fallback accepted any password ≥ 4 characters (incl. the demo SUPER_ADMIN) and synthesised accounts.~~
   **Fixed** (2026-11-08, `tests/auth-demo-fallback.test.ts`): in production only a demo account's exact stored password
   is accepted and nothing is synthesised; development keeps the demo conveniences. Remaining: the demo accounts and their
   passwords are still hard-coded in `backend/src/store/demoUsers.ts` — rotate/remove them for production (owner decision).
2. `/api/attendance-reports/*` and `POST /api/attendance-reports/import-offline`: no role check and `?schoolId` is honoured for any role (cross-tenant read/write).
3. `reviews.ts` student-leave and photo approve/reject: STUDENT/PARENT tokens fall into the admin branch; `POST /reviews/leaves` trusts body `studentId`.
4. `GET /reviews/teacher-leaves` and `/export-excel`: any school role can list/export teacher leaves.
5. `POST /api/health/email-test` is public and sends mail through the platform SMTP to any address.
6. `POST /api/subscriptions/run-worker`: any authenticated role can run the global subscription worker.
7. `GET /api/analytics/export-students`: any school role can export the student list.
8. `parentOnboardingService.createParent` inserts into a `users.active` column that does not exist in `schema.sql` (pre-existing; untouched apart from tenant scoping).

## Fixed in this change (P6)

| Hole | Fix | Test |
| --- | --- | --- |
| Teacher-leave approve/reject reachable by any role | `requireRoles('SCHOOL_ADMIN','SUPER_ADMIN')` on both routes | `tests/rbac-security-fixes.test.ts` |
| Parent onboarding list/link not school-scoped | service + router scoped to caller's canonical school; foreign parent/student → 404 | same |
| `/api/production/jobs` never authenticated (SA always got 403) | `requireAuth` + `requireRoles('SUPER_ADMIN')` | same |

Each test fails on the pre-fix code (checked with `git stash` of the four fixed files: 5 of 6 checks fail) and passes after.

## Test commands

```bash
cd backend
npx tsx tests/rbac-baseline.test.ts --mode=shadow     # R1 guard (also --mode=off, --mode=enforce)
npx tsx tests/rbac-resolver.test.ts                    # pure resolver + catalog + bindings
npx tsx tests/rbac-enforcement.test.ts                 # integration groups 1–14
npx tsx tests/rbac-security-fixes.test.ts              # group 16
npx tsx tests/tools/generate-rbac-route-map.ts         # regenerates docs/rbac/route-permission-map.md
cd .. && npm run dev:frontend & npx playwright test tests/e2e/rbac-access.spec.ts   # group 15 (API mocked)
```

All RBAC tests are side-effect free: SQL is forced to DisabledPool or an in-memory store, legacy handlers are
stubbed, mail/SMS/payment env names are blanked. The pre-existing `npm test` suite talks to the configured
databases and was intentionally not run.
