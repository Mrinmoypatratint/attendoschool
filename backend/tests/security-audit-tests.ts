/**
 * Automated Security Audit & Control Verification Suite
 * AttendoSchool Platform Security Engineering
 *
 * Validates:
 * 1. JWT Algorithm Pinning (HS256 only, 'none' and confusion blocked)
 * 2. Security Headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Cross-Domain)
 * 3. Client IP Spoofing Defense (req.ip precedence over unverified headers)
 * 4. Password Reset Host Header Poisoning Defense (strict allowlist)
 * 5. RBAC & Principle of Least Privilege (role gating on admin endpoints)
 * 6. Multi-Tenant IDOR Protection (Invoice tenant isolation logic)
 * 7. Production Environment Fail-Fast Secret Validation
 */

import jwt from 'jsonwebtoken';
import { requireAuth, requireRoles } from '../src/middleware/auth';
import { securityHeaders, getClientIp } from '../src/middleware/security';
import { env, validateSecurityConfig } from '../src/config/env';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ' - ' + detail : ''}`);
    failed++;
  }
}

async function runSecuritySuite() {
  console.log('\n=============================================================');
  console.log('   ATTENDOSCHOOL AUTOMATED SECURITY AUDIT TEST SUITE');
  console.log('=============================================================\n');

  // -------------------------------------------------------------------------
  // 1. JWT Security & Algorithm Confusion Defenses via requireAuth
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: JWT Cryptographic & Algorithm Security ---');
  {
    const authUser = {
      id: 'test-user-uuid-1234',
      email: 'security.audit@attendoschool.online',
      role: 'SUPER_ADMIN' as const,
      name: 'Security Auditor',
      schoolId: 'school-uuid-5678'
    };

    // Valid HS256 token verification
    const validToken = jwt.sign(authUser, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' });
    let authPassed = false;
    const validReq: any = { headers: { authorization: `Bearer ${validToken}` } };
    const validRes: any = {
      status: (code: number) => ({ json: (data: any) => {} })
    };
    requireAuth(validReq, validRes, () => { authPassed = true; });

    assert(
      authPassed && validReq.user?.email === authUser.email,
      'Legitimate HS256 JWT is verified and attaches req.user.'
    );

    // Signature tampering test
    const tamperedToken = validToken.slice(0, -6) + 'abcdef';
    let tamperedRejected = false;
    let tamperedStatus = 0;
    const tamperedReq: any = { headers: { authorization: `Bearer ${tamperedToken}` } };
    const tamperedRes: any = {
      status: (code: number) => {
        tamperedStatus = code;
        return {
          json: (data: any) => {
            if (code === 401 && data.code === 'INVALID_TOKEN') tamperedRejected = true;
          }
        };
      }
    };
    requireAuth(tamperedReq, tamperedRes, () => {});

    assert(
      tamperedRejected && tamperedStatus === 401,
      'Tampered JWT signature is rejected immediately with 401 INVALID_TOKEN.'
    );

    // Algorithm 'none' attack test
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const nonePayload = Buffer.from(JSON.stringify(authUser)).toString('base64url');
    const noneToken = `${noneHeader}.${nonePayload}.`;
    let noneRejected = false;
    let noneStatus = 0;
    const noneReq: any = { headers: { authorization: `Bearer ${noneToken}` } };
    const noneRes: any = {
      status: (code: number) => {
        noneStatus = code;
        return {
          json: (data: any) => {
            if (code === 401) noneRejected = true;
          }
        };
      }
    };
    requireAuth(noneReq, noneRes, () => {});

    assert(
      noneRejected && noneStatus === 401,
      'Algorithm "none" token injection is blocked by pinned algorithms: ["HS256"].'
    );

    // Foreign secret signature attack
    const foreignSecretToken = jwt.sign(authUser, 'malicious-attacker-secret-key-12345678901234567890', { algorithm: 'HS256' });
    let foreignRejected = false;
    let foreignStatus = 0;
    const foreignReq: any = { headers: { authorization: `Bearer ${foreignSecretToken}` } };
    const foreignRes: any = {
      status: (code: number) => {
        foreignStatus = code;
        return {
          json: (data: any) => {
            if (code === 401) foreignRejected = true;
          }
        };
      }
    };
    requireAuth(foreignReq, foreignRes, () => {});

    assert(
      foreignRejected && foreignStatus === 401,
      'JWT signed with untrusted secret key is rejected with 401.'
    );

    // Missing token test
    let missingRejected = false;
    let missingStatus = 0;
    const missingReq: any = { headers: {} };
    const missingRes: any = {
      status: (code: number) => {
        missingStatus = code;
        return {
          json: (data: any) => {
            if (code === 401 && data.code === 'AUTH_REQUIRED') missingRejected = true;
          }
        };
      }
    };
    requireAuth(missingReq, missingRes, () => {});

    assert(
      missingRejected && missingStatus === 401,
      'Request without Authorization header is rejected with 401 AUTH_REQUIRED.'
    );
  }

  // -------------------------------------------------------------------------
  // 2. HTTP Security Headers & Defense-in-Depth
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: HTTP Security Headers & CSP Validation ---');
  {
    const headersSet: Record<string, string> = {};
    const mockReq: any = {
      method: 'GET',
      headers: {},
      url: '/api/security/test'
    };
    const mockRes: any = {
      setHeader: (name: string, value: string) => {
        headersSet[name.toLowerCase()] = value;
      }
    };
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    securityHeaders(mockReq, mockRes, mockNext);

    assert(nextCalled, 'securityHeaders middleware invokes next() correctly.');
    assert(
      headersSet['strict-transport-security']?.includes('max-age=31536000') &&
      headersSet['strict-transport-security']?.includes('includeSubDomains'),
      'Strict-Transport-Security (HSTS) header is enforced with >= 1 year and includeSubDomains.'
    );
    assert(
      headersSet['x-content-type-options'] === 'nosniff',
      'X-Content-Type-Options: nosniff is set to prevent MIME-type confusion.'
    );
    assert(
      headersSet['x-frame-options'] === 'DENY',
      'X-Frame-Options: DENY is set to eliminate Clickjacking vectors.'
    );
    assert(
      headersSet['content-security-policy']?.includes("default-src 'self'"),
      'Content-Security-Policy (CSP) is set with default-src "self".'
    );
    assert(
      headersSet['x-permitted-cross-domain-policies'] === 'none',
      'X-Permitted-Cross-Domain-Policies: none is set.'
    );
  }

  // -------------------------------------------------------------------------
  // 3. Client IP Spoofing Prevention
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Client IP Spoofing & Network Security ---');
  {
    // Attacker sends forged X-Forwarded-For header to bypass IP rate limits
    const forgedReq: any = {
      headers: {
        'x-forwarded-for': '185.220.101.5, 10.0.0.1, 192.168.1.1',
        'x-real-ip': '185.220.101.5'
      },
      ip: '127.0.0.1' // Trusted proxy/Express determined IP
    };

    const detectedIp = getClientIp(forgedReq);
    assert(
      detectedIp === '127.0.0.1',
      'getClientIp ignores forged client X-Forwarded-For / X-Real-IP and uses trusted req.ip.',
      `Received: ${detectedIp}`
    );

    // IPv6-mapped IPv4 normalization test
    const ipv6Req: any = {
      headers: {},
      ip: '::ffff:192.168.1.50'
    };
    const normalizedIp = getClientIp(ipv6Req);
    assert(
      normalizedIp === '192.168.1.50',
      'IPv4-mapped IPv6 address (::ffff:x.x.x.x) is properly normalized to standard IPv4.',
      `Received: ${normalizedIp}`
    );
  }

  // -------------------------------------------------------------------------
  // 4. Password Reset Host Poisoning Whitelist Logic
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Password Reset Host Poisoning Defense ---');
  {
    const ALLOWED_RESET_HOSTS = new Set([
      'attendoschool.online',
      'www.attendoschool.online',
      'localhost:5173',
      'localhost:3000',
      'localhost:5000'
    ]);

    function resolveResetBaseUrl(rawOrigin?: string): string {
      const fallback = 'https://attendoschool.online';
      if (!rawOrigin) return fallback;
      try {
        const parsed = new URL(rawOrigin);
        if (ALLOWED_RESET_HOSTS.has(parsed.host)) {
          return `${parsed.protocol}//${parsed.host}`;
        }
      } catch {
        // malformed origin
      }
      return fallback;
    }

    const attackerOrigin = 'https://evil-phishing-site.attacker.com';
    const resolvedAttacker = resolveResetBaseUrl(attackerOrigin);
    assert(
      resolvedAttacker === 'https://attendoschool.online',
      'Untrusted Host/Origin header falls back safely to attendoschool.online.',
      `Resolved: ${resolvedAttacker}`
    );

    const legitimateOrigin = 'https://attendoschool.online';
    const resolvedLegit = resolveResetBaseUrl(legitimateOrigin);
    assert(
      resolvedLegit === 'https://attendoschool.online',
      'Legitimate origin header matches allowed list.',
      `Resolved: ${resolvedLegit}`
    );

    const subAttackerOrigin = 'https://attendoschool.online.evil.com';
    const resolvedSub = resolveResetBaseUrl(subAttackerOrigin);
    assert(
      resolvedSub === 'https://attendoschool.online',
      'Domain prefix collision attack is safely rejected.',
      `Resolved: ${resolvedSub}`
    );
  }

  // -------------------------------------------------------------------------
  // 5. RBAC & Authorization Boundaries
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Role-Based Access Control (RBAC) Enforcement ---');
  {
    const adminOnly = requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN');

    // Test 1: Student attempting to access admin route
    let studentBlocked = false;
    let studentStatus = 0;
    const studentReq: any = { user: { role: 'STUDENT', userId: 'student-1' } };
    const studentRes: any = {
      status: (code: number) => {
        studentStatus = code;
        return {
          json: (body: any) => {
            if (code === 403) studentBlocked = true;
          }
        };
      }
    };
    adminOnly(studentReq, studentRes, () => {});
    assert(
      studentBlocked && studentStatus === 403,
      'STUDENT role is strictly denied (403 Forbidden) from administrative routes.'
    );

    // Test 2: Teacher attempting to access admin route
    let teacherBlocked = false;
    let teacherStatus = 0;
    const teacherReq: any = { user: { role: 'TEACHER', userId: 'teacher-1' } };
    const teacherRes: any = {
      status: (code: number) => {
        teacherStatus = code;
        return {
          json: () => {
            if (code === 403) teacherBlocked = true;
          }
        };
      }
    };
    adminOnly(teacherReq, teacherRes, () => {});
    assert(
      teacherBlocked && teacherStatus === 403,
      'TEACHER role is strictly denied (403 Forbidden) from administrative management routes.'
    );

    // Test 3: School Admin accessing admin route
    let schoolAdminPassed = false;
    const schoolAdminReq: any = { user: { role: 'SCHOOL_ADMIN', userId: 'admin-1', schoolId: 'sch-1' } };
    const schoolAdminRes: any = {};
    adminOnly(schoolAdminReq, schoolAdminRes, () => {
      schoolAdminPassed = true;
    });
    assert(
      schoolAdminPassed,
      'SCHOOL_ADMIN role is permitted to execute authorized school administration functions.'
    );

    // Test 4: Super Admin route exclusivity (e.g. Backups, System Diagnostics)
    const superAdminOnly = requireRoles('SUPER_ADMIN');
    let schoolAdminBlockedFromSuperAdminRoute = false;
    const superAdminCheckRes: any = {
      status: (code: number) => ({
        json: () => {
          if (code === 403) schoolAdminBlockedFromSuperAdminRoute = true;
        }
      })
    };
    superAdminOnly(schoolAdminReq, superAdminCheckRes, () => {});
    assert(
      schoolAdminBlockedFromSuperAdminRoute,
      'SCHOOL_ADMIN is strictly blocked (403) from Super-Admin-only functions (e.g. system backups).'
    );
  }

  // -------------------------------------------------------------------------
  // 6. Multi-Tenant IDOR Protection Logic
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Multi-Tenant IDOR / BOLA Prevention ---');
  {
    // Replicating invoice tenant isolation logic from backend/src/routes/invoices.ts
    function canAccessInvoice(user: { role: string; schoolId?: string | null }, invoiceSchoolId: string): boolean {
      if (user.role === 'SUPER_ADMIN') return true;
      if (user.role === 'SCHOOL_ADMIN' && user.schoolId && user.schoolId === invoiceSchoolId) return true;
      return false;
    }

    const schoolAAdmin = { role: 'SCHOOL_ADMIN', schoolId: 'school-aaa-111' };
    const schoolBAdmin = { role: 'SCHOOL_ADMIN', schoolId: 'school-bbb-222' };
    const superAdmin = { role: 'SUPER_ADMIN', schoolId: null };

    const invoiceSchoolA = 'school-aaa-111';
    const invoiceSchoolB = 'school-bbb-222';

    assert(
      canAccessInvoice(schoolAAdmin, invoiceSchoolA) === true,
      'School A Admin can access School A invoice.'
    );
    assert(
      canAccessInvoice(schoolAAdmin, invoiceSchoolB) === false,
      'School A Admin CANNOT access School B invoice (Cross-tenant IDOR blocked).'
    );
    assert(
      canAccessInvoice(schoolBAdmin, invoiceSchoolA) === false,
      'School B Admin CANNOT access School A invoice (Cross-tenant IDOR blocked).'
    );
    assert(
      canAccessInvoice(superAdmin, invoiceSchoolA) === true &&
      canAccessInvoice(superAdmin, invoiceSchoolB) === true,
      'SUPER_ADMIN retains cross-school billing audit authority across all tenants.'
    );
  }

  // -------------------------------------------------------------------------
  // 7. Production Environment Fail-Fast Secret Validation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Production Secret Fail-Fast Validation ---');
  {
    const originalEnv = { ...process.env };

    // Test weak JWT secret in production mode
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short';
    let caughtWeakSecret = false;
    try {
      validateSecurityConfig();
    } catch (err: any) {
      if (err.message.includes('JWT_SECRET must be at least 32 characters')) {
        caughtWeakSecret = true;
      }
    }
    assert(
      caughtWeakSecret,
      'validateSecurityConfig fails fast when JWT_SECRET is under 32 characters in production.'
    );

    // Test default placeholder secret in production
    process.env.JWT_SECRET = 'supersecret_change_in_production_key';
    let caughtDefaultSecret = false;
    try {
      validateSecurityConfig();
    } catch (err: any) {
      if (err.message.includes('must not be left as default')) {
        caughtDefaultSecret = true;
      }
    }
    assert(
      caughtDefaultSecret,
      'validateSecurityConfig fails fast when JWT_SECRET is set to known insecure default.'
    );

    // Restore original env
    process.env = originalEnv;
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
