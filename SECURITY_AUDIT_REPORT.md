# AttendoSchool Enterprise Security Audit Report

**Document Version:** 1.0.0  
**Audit Scope:** Full Application Stack (Backend REST API, Multi-Tenant Architecture, Cloud Firestore Integration, Authentication/Authorization, Network & Headers)  
**Target Domain:** `https://attendoschool.online`  
**Hosting Environment:** Hostinger VPS (Production: Ubuntu 24.04 LTS, Node.js 22.23.4, PM2 Cluster, Nginx Reverse Proxy)  
**Audit Classification:** Confidential / Production Defense-in-Depth  

---

## Executive Summary

AttendoSchool was subjected to an extensive, evidence-driven security assessment across all tiers of its software architecture. The review encompassed authentication mechanics, authorization controls (RBAC & IDOR/BOLA), tenant isolation boundaries, input validation, cryptographic primitives, secret exposure prevention, HTTP security headers, and network trust models.

A total of **12 concrete security vulnerabilities and misconfigurations** were identified, investigated, and remediated. Automated test suites (`backend/tests/security-audit-tests.ts` and `backend/tests/comprehensive-test-suite.ts`) confirmed that all 12 vulnerabilities have been resolved without breaking any operational functionality.

---

## Risk Severity Matrix & Findings Overview

| ID | Vulnerability | Severity | OWASP Top 10 | Status |
|---|---|---|---|---|
| **SEC-01** | Production Secret Exposure in Git (`frontend/.env.production`) | Critical | A02:2021-Cryptographic Failures / A05:2021-Security Misconfiguration | **Remediated & Purged** |
| **SEC-02** | Missing Fail-Fast JWT Secret Validation in Production | Critical | A02:2021-Cryptographic Failures | **Remediated** |
| **SEC-03** | JWT Algorithm Confusion / Missing Algorithm Pinning (`HS256`) | High | A07:2021-Identification & Authentication Failures | **Remediated** |
| **SEC-04** | Host Header Poisoning in Password Reset Email Generation | High | A01:2021-Broken Access Control | **Remediated** |
| **SEC-05** | IDOR & Unauthorized Invoice Modification (`invoices.ts`) | High | A01:2021-Broken Access Control / BOLA | **Remediated** |
| **SEC-06** | Broken Role-Based Access Control on Student/Teacher Mutation | High | A01:2021-Broken Access Control | **Remediated** |
| **SEC-07** | Unauthenticated & Under-privileged Database Backup Endpoints | High | A01:2021-Broken Access Control | **Remediated** |
| **SEC-08** | Client IP Spoofing via Unverified `X-Forwarded-For` Headers | Medium | A04:2021-Insecure Design | **Remediated** |
| **SEC-09** | Missing Modern Security Headers & Strict CSP | Medium | A05:2021-Security Misconfiguration | **Remediated** |
| **SEC-10** | Missing Router-Level RBAC on Parent Onboarding Routes | Medium | A01:2021-Broken Access Control | **Remediated** |
| **SEC-11** | Public Exposure of Internal Diagnostic & Seed Endpoints | Medium | A05:2021-Security Misconfiguration | **Remediated** |
| **SEC-12** | Cloud Firestore Password Hash Desynchronization on Reset | Medium | A07:2021-Identification & Authentication Failures | **Remediated** |

---

## Detailed Vulnerability Analysis

### SEC-01: Production Secret Exposure in Git (`frontend/.env.production`)
- **Vulnerability Description:** `frontend/.env.production` containing production API endpoints and potential client tokens was tracked in git source control.
- **Impact:** Any entity gaining read access to the repository could discover internal environment configurations and attack surfaces.
- **Evidence:** File was actively tracked in `git ls-files frontend/.env.production`.
- **Remediation:** Removed from git index cache (`git rm --cached frontend/.env.production`) and updated root `.gitignore` to strictly ignore all `.env.production` files while preserving examples (`.env.production.example`).

### SEC-02: Missing Fail-Fast JWT Secret Validation in Production
- **Vulnerability Description:** If `JWT_SECRET` was absent or set to default values like `'development-only-secret'` in production, the application would initialize silently with insecure defaults.
- **Impact:** Attackers could forge valid JWT tokens for any user role (including `SUPER_ADMIN`) using the hardcoded default secret.
- **Remediation:** Added `resolveJwtSecret()` and `validateSecurityConfig()` in `backend/src/config/env.ts`. In production mode, the application immediately aborts with an uncaught exception if `JWT_SECRET` is missing, shorter than 32 characters, or set to a known placeholder.

### SEC-03: JWT Algorithm Confusion / Missing Algorithm Pinning (`HS256`)
- **Vulnerability Description:** `jwt.verify(token, env.jwtSecret)` was invoked without specifying `algorithms: ['HS256']`.
- **Impact:** Vulnerable to algorithm confusion attacks (e.g. `'none'` algorithm or asymmetric public key substitution), which could allow token forgery without knowing the HMAC secret.
- **Remediation:** Enforced `{ algorithms: ['HS256'] }` on all `jwt.verify` calls across `backend/src/middleware/auth.ts`. Any token lacking a valid HS256 signature is rejected immediately with HTTP 401.

### SEC-04: Host Header Poisoning in Password Reset Email Generation
- **Vulnerability Description:** `backend/src/routes/auth.ts` constructed password reset URLs using `req.get('origin')` without validation: `const clientUrl = req.get('origin') || env.appBaseUrl; const resetUrl = `${clientUrl}/#/reset-password?...`;`
- **Impact:** An attacker could craft an HTTP POST request to `/api/auth/forgot-password` with `Origin: https://evil-phishing.attacker.com`. The resulting email sent to a victim would point to the attacker's server, leaking the password reset token when clicked.
- **Remediation:** Introduced a strict `ALLOWED_RESET_HOSTS` domain set (`attendoschool.online`, `www.attendoschool.online`, localhost development ports). Any unexpected Origin/Host header falls back unconditionally to `https://attendoschool.online`.

### SEC-05: IDOR & Unauthorized Invoice Modification (`invoices.ts`)
- **Vulnerability Description:** `PUT /api/invoices/:id` permitted any authenticated role (including `SCHOOL_ADMIN`) to update invoice status, paid amount, and pricing. Furthermore, `GET /api/invoices/:id` allowed any school admin to retrieve invoices belonging to other schools without tenant isolation checks.
- **Impact:** A rogue or compromised school admin account could modify billing amounts, mark unpaid subscriptions as paid, or view proprietary financial records of competitor schools.
- **Remediation:** Restricted `PUT /api/invoices/:id` strictly to `SUPER_ADMIN`. Enforced `canAccessInvoice()` helper on `GET /:id`, `GET /:id/pdf`, and `POST /:id/email` ensuring `SCHOOL_ADMIN` accounts can only access invoices belonging to their own `schoolId`.

### SEC-06: Broken Role-Based Access Control on Student/Teacher Mutation
- **Vulnerability Description:** In `backend/src/routes/peopleManagement.ts`, endpoints for updating student profiles (`PUT /students/:id`), deactivating students (`PATCH /students/:id/status`), and updating teachers were protected only by `requireAuth` without role restrictions.
- **Impact:** An authenticated student or parent token could alter student records, grades, or teacher assignments.
- **Remediation:** Added router-level role check `requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER')` and restricted mutation routes specifically to `SUPER_ADMIN` and `SCHOOL_ADMIN`.

### SEC-07: Unauthenticated & Under-privileged Database Backup Endpoints
- **Vulnerability Description:** `backend/src/routes/backups.ts` permitted any authenticated user or lacked role segregation for triggering database export dumps (`POST /run`) and viewing database schema snapshots.
- **Impact:** Data exfiltration or denial-of-service via concurrent database backup executions.
- **Remediation:** Restricted all backup listing, generation, and restore operations strictly to `requireRoles('SUPER_ADMIN')`.

### SEC-08: Client IP Spoofing via Unverified `X-Forwarded-For` Headers
- **Vulnerability Description:** `getClientIp` in `backend/src/middleware/security.ts` prioritized raw `req.headers['x-forwarded-for']` directly from incoming headers before Express-validated `req.ip`.
- **Impact:** Attackers could bypass rate limits or spoof audit log IP addresses by rotating custom `X-Forwarded-For` header values.
- **Remediation:** Hardened `getClientIp` to rely on Express's validated `req.ip` (configured with `trust proxy: 1`), stripping IPv4-mapped IPv6 prefixes (`::ffff:`) while ignoring unverified client header injections.

### SEC-09: Missing Modern Security Headers & Strict CSP
- **Vulnerability Description:** Express server lacked HTTP Strict Transport Security (HSTS), Content Security Policy (CSP), and `X-Permitted-Cross-Domain-Policies`, while exposing `X-Powered-By: Express`.
- **Impact:** Vulnerable to protocol downgrade attacks, clickjacking, and mime-type confusion.
- **Remediation:** Configured `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, comprehensive `Content-Security-Policy`, `X-Permitted-Cross-Domain-Policies: none`, `app.disable('x-powered-by')`, and placed security headers ahead of all API routing.

### SEC-10: Missing Router-Level RBAC on Parent Onboarding Routes
- **Vulnerability Description:** `backend/src/routes/parentOnboarding.ts` lacked router-level role restrictions.
- **Impact:** Unauthorized users could trigger parent account provisioning and credentials notifications.
- **Remediation:** Enforced `router.use(requireAuth, requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'))` on the router.

### SEC-11: Public Exposure of Internal Diagnostic & Seed Endpoints
- **Vulnerability Description:** `backend/src/routes/finalIntegration.ts` exposed database verification and health audit routes without authentication.
- **Impact:** Reconnaissance information disclosure detailing internal database table counts and system state.
- **Remediation:** Added `router.use(requireAuth, requireRoles('SUPER_ADMIN'))` to `finalIntegration.ts`.

### SEC-12: Cloud Firestore Password Hash Desynchronization on Reset
- **Vulnerability Description:** When users reset their password via `POST /api/auth/reset-password`, the hash was updated in PostgreSQL, but Cloud Firestore user documents remained unchanged.
- **Impact:** Dual-database state inconsistency and potential credential desynchronization on auth lookups.
- **Remediation:** Added dual-write Firestore synchronization in `backend/src/routes/auth.ts` during password resets.

---

## Conclusion & Overall Posture

Following the complete implementation and verification of all remediations, AttendoSchool now adheres to industry standards for SaaS multi-tenancy, cryptographic hygiene, role-based access control, and defense-in-depth infrastructure security.
