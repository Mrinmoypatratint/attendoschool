/**
 * RBAC probe harness (P0 discovery / baseline).
 *
 * Loads the REAL Express app with every REAL middleware (requireAuth, requireRoles,
 * router-level inline guards, requireAttendanceTeacher, …) but replaces the FINAL
 * handler of every route with a probe responder. This records which principals the
 * middleware chain lets through, with zero side effects:
 *   - SQL is forced to DisabledPool (DATABASE_URL / SUPABASE_DATABASE_URL blanked)
 *   - route handlers never execute, so no Firestore / mail / payment / SMS I/O
 *   - mail/SMS/payment env names are blanked as a second line of defence
 *
 * LIMITATION (documented in docs/rbac/route-permission-map.md): role checks written
 * INSIDE a final handler are not exercised by this probe. They are listed separately
 * in the map as "inline" checks.
 *
 * This file must be imported BEFORE anything from ../../src.
 */
import path from 'path';
import { createRequire } from 'module';

// ---------------------------------------------------------------------------
// 1. Environment isolation (dotenv never overrides values already present)
// ---------------------------------------------------------------------------
const BLANK = [
  'DATABASE_URL', 'SUPABASE_DATABASE_URL', 'REDIS_URL', 'REDIS_CACHE_URL', 'REDIS_HOST',
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'BREVO_API_KEY', 'SENDINBLUE_API_KEY', 'RESEND_API_KEY',
  'GMAIL_RELAY_URL', 'GOOGLE_SCRIPT_URL', 'SMS_PROVIDER_URL', 'SMS_PROVIDER_API_KEY',
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'KEEP_ALIVE_URL'
];
for (const k of BLANK) process.env[k] = '';
process.env.EMAIL_ENABLED = 'false';
process.env.SKIP_SMTP_SYNC = 'true';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT = '1000000';
// Test-only signing secret. Never a real secret; never printed.
process.env.JWT_SECRET = 'rbac-baseline-test-secret-not-for-production-0123456789';

// ---------------------------------------------------------------------------
// 2. Patch router.Route so the LAST function of every route is a probe responder
// ---------------------------------------------------------------------------
const req0 = createRequire(__filename);
const expressMain = req0.resolve('express');
const routerPkg = req0(req0.resolve('router', { paths: [path.dirname(expressMain)] }));
const Route = routerPkg.Route;
export const PROBE_HEADER = 'x-rbac-probe';

let probeEnabled = true;
/** Routers imported while disabled keep their REAL handlers (e.g. /api/access under test). */
export function setProbeEnabled(v: boolean) { probeEnabled = v; }

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];
for (const m of METHODS) {
  const orig = Route.prototype[m];
  Route.prototype[m] = function patched(this: any, ...handlers: any[]) {
    const flat = handlers.flat(Infinity);
    if (probeEnabled && flat.length > 0) {
      const routePath = this.path;
      flat[flat.length - 1] = function rbacProbeHandler(_req: any, res: any) {
        res.setHeader(PROBE_HEADER, 'HANDLER_REACHED');
        res.status(200).json({ probe: 'HANDLER_REACHED', route: String(routePath) });
      };
    }
    return orig.apply(this, flat);
  };
}

// ---------------------------------------------------------------------------
// 3. Load app + discover mounts (static parse of app.ts) and route tables
// ---------------------------------------------------------------------------
import fs from 'fs';

export type RouteEntry = {
  method: string;            // GET/POST/…
  mount: string;             // e.g. /api/communication
  routePath: string;         // e.g. /announcements/:id
  routeKey: string;          // String(route.path) as registered (arrays joined by ',')
  fullPath: string;          // mount + routePath (pattern)
  module: string;            // e.g. routes/communication
  appLevelAuth: boolean;     // app.use(prefix, requireAuth, router)
};

const SRC = path.resolve(__dirname, '../../src');

export function parseMounts(): { prefix: string; ident: string; module: string; appAuth: boolean }[] {
  const appSrc = fs.readFileSync(path.join(SRC, 'app.ts'), 'utf8');
  const imports = new Map<string, string>();
  for (const m of appSrc.matchAll(/^import\s+(\w+)\s+from\s+'\.\/(routes\/\w+)';/gm)) imports.set(m[1], m[2]);
  const mounts: { prefix: string; ident: string; module: string; appAuth: boolean }[] = [];
  for (const m of appSrc.matchAll(/app\.use\('([^']+)',\s*(requireAuth,\s*)?(\w+)\)/g)) {
    const ident = m[3];
    if (!imports.has(ident)) continue;
    mounts.push({ prefix: m[1], ident, module: imports.get(ident)!, appAuth: Boolean(m[2]) });
  }
  return mounts;
}

function joinPath(a: string, b: string) {
  const s = (a.replace(/\/$/, '') + '/' + b.replace(/^\//, '')).replace(/\/$/, '');
  return s || '/';
}

export function collectRoutes(): RouteEntry[] {
  const out: RouteEntry[] = [];
  for (const mt of parseMounts()) {
    const mod = req0(path.join(SRC, mt.module));
    const router = mod.default || mod;
    const stack: any[] = router?.stack || [];
    for (const layer of stack) {
      if (!layer.route) continue;
      const rp = layer.route.path;
      const paths = Array.isArray(rp) ? rp : [rp];
      for (const p of paths) {
        for (const method of Object.keys(layer.route.methods)) {
          if (method === '_all') continue;
          out.push({
            method: method.toUpperCase(),
            mount: mt.prefix,
            routePath: String(p),
            routeKey: String(rp),
            fullPath: joinPath(mt.prefix, String(p)),
            module: mt.module,
            appLevelAuth: mt.appAuth
          });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Principals and request execution
// ---------------------------------------------------------------------------
export const SCHOOL_A = '11111111-1111-4111-8111-111111111111';
export const SCHOOL_B = '22222222-2222-4222-8222-222222222222';

export type Principal = { key: string; user: any | null };
export const PRINCIPALS: Principal[] = [
  { key: 'ANON', user: null },
  { key: 'SUPER_ADMIN', user: { id: 'sa-1', schoolId: null, name: 'SA', email: 'sa@test.local', role: 'SUPER_ADMIN' } },
  { key: 'SCHOOL_ADMIN', user: { id: 'adm-a', schoolId: SCHOOL_A, name: 'Admin A', email: 'a@test.local', role: 'SCHOOL_ADMIN' } },
  { key: 'TEACHER', user: { id: 'tch-a', schoolId: SCHOOL_A, name: 'Teacher A', email: 't@test.local', role: 'TEACHER' } },
  { key: 'STUDENT', user: { id: 'stu-u-a', schoolId: SCHOOL_A, name: 'Student A', email: 's@test.local', role: 'STUDENT', studentId: 'stu-a', classId: 'cls-a', sectionId: 'sec-a' } },
  { key: 'PARENT', user: { id: 'par-a', schoolId: SCHOOL_A, name: 'Parent A', email: 'p@test.local', role: 'PARENT' } },
  // Cross-school: school B admin. At middleware level identical to SCHOOL_ADMIN; tenant checks
  // inside handlers are covered by dedicated tests in later phases.
  { key: 'SCHOOL_ADMIN_B', user: { id: 'adm-b', schoolId: SCHOOL_B, name: 'Admin B', email: 'b@test.local', role: 'SCHOOL_ADMIN' } },
];

export function concretePath(pattern: string): string {
  return pattern
    .replace(/\{\/?\*\w*\}/g, '')
    .replace(/\*\w*/g, 'probe')
    .replace(/:(\w+)\??/g, (_m, name) => `probe-${name}`);
}

export type Outcome = 'ALLOW' | 'DENY_401' | 'DENY_403' | string;

export function classify(status: number, probeReached: boolean): Outcome {
  if (probeReached) return 'ALLOW';
  if (status === 401) return 'DENY_401';
  if (status === 403) return 'DENY_403';
  return `MW_${status}`; // a middleware answered with another status (e.g. 402, 400, 404)
}
