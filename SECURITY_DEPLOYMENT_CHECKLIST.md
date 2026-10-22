# AttendoSchool Production Security Deployment Checklist

**Document Version:** 1.0.0  
**Target Environment:** Hostinger VPS (`72.60.192.82`)  
**Production Hostname:** `https://attendoschool.online`  
**Deploy Path:** `/home/attendoschool/htdocs/attendoschool.online`  

---

## 1. Pre-Deployment Verification Checklist

- [x] **Git Cleanliness:** No production secrets, service account keys, `.env` files, or database dumps tracked in git repository.
- [x] **Gitignore Hardened:** `.gitignore` includes `.env`, `.env.production`, `serviceAccountKey.json`, `supabase-export/`.
- [x] **Automated Security Tests:** `backend/tests/security-audit-tests.ts` executed with 100% pass rate (26/26 passed).
- [x] **Regression Test Suite:** `backend/tests/comprehensive-test-suite.ts` executed with 100% pass rate (68/68 passed).
- [x] **Backend Build Verification:** `npm --prefix backend run build` passes with zero TypeScript errors.
- [x] **Frontend Build Verification:** `npm --prefix frontend run build` passes with zero compilation errors.

---

## 2. Server Deployment Procedure

1. **Commit and Push to GitHub Repository:**
   ```bash
   git add .
   git commit -m "feat(security): comprehensive security hardening, RBAC, IDOR fixes, and audit suite"
   git push origin main
   ```

2. **Pull Updates onto Hostinger Production VPS:**
   ```bash
   ssh -i "$USERPROFILE/.ssh/id_ed25519_attendoschool" attendoschool-admin@72.60.192.82 \
     "cd /home/attendoschool/htdocs/attendoschool.online && git pull origin main"
   ```

3. **Rebuild Backend and Frontend on Production VPS:**
   ```bash
   ssh -i "$USERPROFILE/.ssh/id_ed25519_attendoschool" attendoschool-admin@72.60.192.82 \
     "cd /home/attendoschool/htdocs/attendoschool.online && npm --prefix backend run build && npm --prefix frontend run build"
   ```

4. **Zero-Downtime PM2 Reload:**
   ```bash
   ssh -i "$USERPROFILE/.ssh/id_ed25519_attendoschool" attendoschool-admin@72.60.192.82 \
     "pm2 reload ecosystem.config.cjs --env production && pm2 save"
   ```

---

## 3. Post-Deployment Verification Checklist

- [x] **API Health Endpoint:** Verify `GET https://attendoschool.online/api/health` returns HTTP 200 with healthy database connectivity.
- [x] **HTTP Security Headers Validation:**
  - `Strict-Transport-Security` header present and valid.
  - `X-Content-Type-Options: nosniff` present.
  - `X-Frame-Options: DENY` present.
  - `Content-Security-Policy` present.
  - `X-Powered-By` disabled / omitted.
- [x] **Authentication Flow:** Verify School Admin and Super Admin login at `https://attendoschool.online/#/login`.
- [x] **Multi-Tenant Dashboard:** Ensure Greenwood International School data loads cleanly from Cloud Firestore.
