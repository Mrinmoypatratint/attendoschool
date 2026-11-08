# AttendoSchool Security Remediation Log

**Log Version:** 1.0.0  
**Lead Engineer:** Principal Application Security Engineer  
**Date:** October 22, 2026  
**Status:** All Remediations Implemented, Tested, and Verified  

---

## Remediation Activity Summary

| Vulnerability Ref | Affected Component | Specific Change Description | Commit / Verification |
|---|---|---|---|
| **SEC-01** | `frontend/.env.production`, `.gitignore` | Purged `frontend/.env.production` from git cache. Configured `.gitignore` to strictly ignore all `.env.production` variants across the repository. | `git rm --cached`, Verified via `git status` |
| **SEC-02** | `backend/src/config/env.ts` | Added `validateSecurityConfig()` with strict production checks: enforces `JWT_SECRET` length >= 32 characters and rejects known insecure default values. | Unit tested in `security-audit-tests.ts` |
| **SEC-03** | `backend/src/middleware/auth.ts` | Hardened `jwt.verify` by explicitly setting `{ algorithms: ['HS256'] }`. Removed weak fallback secret checks in production mode. | Verified with algorithm-confusion test suite |
| **SEC-04** | `backend/src/routes/auth.ts` | Added `ALLOWED_RESET_HOSTS` domain set. Replaced dynamic `req.get('origin')` with strict whitelist resolution to prevent Host Header Poisoning. | Verified with spoofed host injection tests |
| **SEC-05** | `backend/src/routes/invoices.ts` | Restricted `PUT /:id` to `SUPER_ADMIN`. Added `canAccessInvoice()` helper to prevent cross-tenant invoice inspection (`GET /:id`, `GET /:id/pdf`, `POST /:id/email`). | Verified in multi-tenant IDOR test cases |
| **SEC-06** | `backend/src/routes/peopleManagement.ts` | Added router-level authorization `requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER')`. Restricted student and teacher mutation endpoints strictly to Admins. | Verified RBAC test suite (STUDENT blocked) |
| **SEC-07** | `backend/src/routes/backups.ts` | Restricted all database backup and restore operations to `requireRoles('SUPER_ADMIN')`. | Verified role boundary test |
| **SEC-08** | `backend/src/middleware/security.ts` | Hardened `getClientIp` function to rely on validated `req.ip` from Express rather than spoofable raw client headers. Normalized IPv4-mapped IPv6. | Verified with spoofed `X-Forwarded-For` tests |
| **SEC-09** | `backend/src/middleware/security.ts`, `app.ts` | Added HSTS (1 year + includeSubDomains), strict CSP, `X-Permitted-Cross-Domain-Policies: none`. Disabled `x-powered-by`. Moved security middleware ahead of route declarations. | Verified header assertion tests |
| **SEC-10** | `backend/src/routes/parentOnboarding.ts` | Added router-level `requireAuth, requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN')`. | Verified router protection |
| **SEC-11** | `backend/src/routes/finalIntegration.ts` | Protected internal verification routes with `requireAuth, requireRoles('SUPER_ADMIN')`. | Verified diagnostic protection |
| **SEC-12** | `backend/src/routes/auth.ts` | Implemented Firestore user document password hash sync in `POST /reset-password` alongside PostgreSQL update. | Code inspection & regression test |
| **SEC-13** | `backend/src/routes/reviews.ts` | Teacher-leave approve/reject restricted to `requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN')` (was reachable by any authenticated role). (2026-11-08) | `backend/tests/rbac-security-fixes.test.ts` (fails before, passes after) |
| **SEC-14** | `backend/src/routes/parentOnboarding.ts`, `services/parentOnboardingService.ts` | Parent list/create/link scoped to the caller's canonical school; foreign parent or student → 404; existing users of other schools are never overwritten. (2026-11-08) | `backend/tests/rbac-security-fixes.test.ts` |
| **SEC-15** | `backend/src/routes/production.ts` | `GET /api/production/jobs` now `requireAuth + requireRoles('SUPER_ADMIN')` (mount was unauthenticated). (2026-11-08) | `backend/tests/rbac-security-fixes.test.ts` |
| **SEC-16** | `backend/src/routes/auth.ts` | Demo login fallback: in production only a demo account's exact stored password is accepted and no accounts are synthesised (previously any password ≥ 4 chars produced a token, incl. SUPER_ADMIN). Owner decision: demo accounts with exact passwords stay enabled in production. (2026-11-08) | `backend/tests/auth-demo-fallback.test.ts` (4 checks fail before, pass after) |
| **SEC-17** | `backend/src/rbac/*`, `routes/access.ts`, `routes/superAdminFeatures.ts` | RBAC & feature control: plan/school/global feature switches, school role and per-person permissions, per-person login disable, audit log; restrict-only, `RBAC_ENFORCEMENT=off|shadow|enforce`. (2026-11-08) | `backend/tests/rbac-*.test.ts`, `tests/e2e/rbac-access.spec.ts`; see `docs/rbac/ROLLOUT.md` |

---

## Detailed Code Diffs & Security Rationale

### 1. `backend/src/middleware/auth.ts`
- **Rationale:** Preventing algorithm confusion attacks where an attacker crafts a token with `"alg": "none"` or manipulates the verification algorithm.
- **Implementation:**
  ```typescript
  req.user = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as AuthUser;
  ```

### 2. `backend/src/routes/auth.ts`
- **Rationale:** Preventing password reset link poisoning by verifying that the origin matches authorized production domains.
- **Implementation:**
  ```typescript
  const ALLOWED_RESET_HOSTS = new Set([
    'attendoschool.online',
    'www.attendoschool.online',
    'localhost:5173',
    'localhost:3000',
    'localhost:5000'
  ]);
  ```

### 3. `backend/src/routes/invoices.ts`
- **Rationale:** Enforcing multi-tenant BOLA/IDOR protection and preventing School Admins from modifying invoice payment records.
- **Implementation:**
  ```typescript
  const canAccessInvoice = (user: any, invoiceSchoolId: string) => {
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.role === 'SCHOOL_ADMIN' && user.schoolId && user.schoolId === invoiceSchoolId) return true;
    return false;
  };
  ```

### 4. `backend/src/middleware/security.ts`
- **Rationale:** Eliminating IP rate limiting bypasses and establishing strict Content Security Policy.
- **Implementation:**
  ```typescript
  export function getClientIp(req: Request): string {
    const directIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return directIp.replace(/^::ffff:/, '');
  }
  ```
