/**
 * P0 generator: docs/rbac/route-permission-map.md
 *
 * Input : tests/fixtures/rbac-baseline.snapshot.json (captured by rbac-baseline.test.ts)
 * Rules : RULES below (DRAFT — becomes backend/src/rbac/catalog.ts route bindings in P1)
 * Fails : if any route in the snapshot matches no rule (every guarded route needs a mapping).
 *
 * Run: npx tsx tests/tools/generate-rbac-route-map.ts
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const snap = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/rbac-baseline.snapshot.json'), 'utf8'));
const results: Record<string, Record<string, string>> = { ...snap.results };
const approvedPath = path.resolve(__dirname, '../fixtures/rbac-baseline.approved-changes.json');
if (fs.existsSync(approvedPath)) {
  const a = JSON.parse(fs.readFileSync(approvedPath, 'utf8'));
  for (const [k, v] of Object.entries<any>(a.changes || {})) results[k] = { ...results[k], ...v.principals };
  for (const [k, v] of Object.entries<any>(a.additions || {})) results[k] = v.principals;
}

const ROLE_AB: Record<string, string> = { SUPER_ADMIN: 'SA', SCHOOL_ADMIN: 'AD', TEACHER: 'T', STUDENT: 'S', PARENT: 'P' };

/** Fold alias mounts onto the canonical path. */
function canonical(p: string): string {
  return p
    .replace(/^\/api\/notifications-v11(?=\/|$)/, '/api/notification-channels')
    .replace(/^\/api\/final-v28(?=\/|$)/, '/api/final-integration')
    .replace(/^\/api\/([a-z-]+)-v\d+(?=\/|$)/, '/api/$1')
    .replace(/^\/api\/notifications-channels(?=\/|$)/, '/api/notification-channels')
    .replace(/^\/api\/attendance(?=\/|$)/, '/api/teacher')
    .replace(/^\/designations(?=\/|$)/, '/api/designations')
    .replace(/^\/leave-policies(?=\/|$)/, '/api/leave-policies')
    .replace(/^\/demo-request(?=\/|$)/, '/api/demo-request');
}

import { findRouteBinding, getPermission } from '../../src/rbac/catalog';

/** Documentation-only notes (inline handler checks + known issues). Bindings come from catalog.ts. */
type Note = { m: RegExp; p: RegExp; note?: string; inline?: string };
const N = (m: string, p: RegExp, extra: Omit<Note, 'm' | 'p'>): Note => ({ m: new RegExp(`^(${m})$`), p, ...extra });
const ANY = 'GET|POST|PUT|PATCH|DELETE';
const NOTES: Note[] = [
  N(ANY, /^\/api\/health\/email-test$/, { note: '⚠️ PUBLIC: sends mail via platform SMTP to any address (known issue)' }),
  N(ANY, /^\/api\/production\/jobs$/, { note: 'P6 fix: requireAuth + SUPER_ADMIN' }),
  N(ANY, /^\/api\/analytics\/(platform|rankings|events)$/, { inline: 'role === SUPER_ADMIN' }),
  N(ANY, /^\/api\/permissions(\/|$)/, { inline: 'router.use: SCHOOL_ADMIN|SUPER_ADMIN', note: 'legacy permission API (not used for enforcement)' }),
  N('POST', /^\/api\/subscriptions\/run-worker$/, { note: '⚠️ known issue: any authenticated role can run the global subscription worker' }),
  N(ANY, /^\/api\/invoices\/:id$/, { note: 'PUT /:id is SUPER_ADMIN only (route guard)' }),
  N('GET', /^\/api\/analytics\/export-students$/, { inline: 'school context only (no role check)', note: '⚠️ known issue' }),
  N(ANY, /^\/api\/parent-onboarding(\/|$)/, { note: 'P6 fix: school-scoped list/create/link' }),
  N('GET', /^\/api\/timetable(\/|$)/, { inline: 'router.use: denies only if no schoolId AND role not staff' }),
  N('POST|PUT', /^\/api\/teacher(\/attendance)?(\/|$)/, { note: 'requireAttendanceTeacher (class-teacher/mentor/temporary) for TEACHER' }),
  N(ANY, /^\/api\/offline-attendance(\/|$)/, { inline: 'router.use: schoolId AND SA|AD|T' }),
  N(ANY, /^\/api\/attendance-reports(\/|$)/, { note: '⚠️ known issue: no role check; ?schoolId honoured for any role' }),
  N('GET|POST', /^\/api\/attendance-corrections(\/|$)/, { inline: 'school context only; /:id/review: SA|AD' }),
  N(ANY, /^\/api\/admin\/mentors$/, { note: 'schoolId required ⇒ SUPER_ADMIN w/o school gets 403' }),
  N('GET', /^\/api\/teacher\/mentor\/attendance-analysis$/, { inline: 'isClassMentor or admin' }),
  N(ANY, /^\/api\/communication\/announcements/, { inline: 'SA|AD|T; teacher own only (reply: authenticated)' }),
  N(ANY, /^\/api\/communication\/(teacher)\//, { inline: 'SA|AD|T' }),
  N(ANY, /^\/api\/communication\/(parent)\//, { inline: 'PARENT only' }),
  N(ANY, /^\/api\/communication\/(delivery-summary|process-scheduled)$/, { inline: 'SA|AD' }),
  N(ANY, /^\/api\/communication\/replies$/, { inline: 'SA|AD|T' }),
  N('PUT', /^\/api\/reviews\/teacher-leaves\/:id\/(approve|reject)$/, { note: 'P6 fix: SCHOOL_ADMIN|SUPER_ADMIN only' }),
  N('GET', /^\/api\/reviews\/teacher-leaves(\/export-excel)?$/, { note: '⚠️ known issue: any school role can list/export teacher leaves' }),
  N(ANY, /^\/api\/reviews\/(leaves|photos)/, { note: '⚠️ known issue: STUDENT/PARENT fall into the admin branch' }),
  N('POST', /^\/api\/student-promotions\//, { inline: 'SA|AD' }),
  N('GET', /^\/api\/(student-promotions|analytics)(\/|$)/, { inline: 'school context only (any role)' }),
  N('POST', /^\/api\/analytics\/snapshot$/, { inline: 'SA|AD' }),
  N(ANY, /^\/api\/parent-portal(\/|$)/, { inline: 'router.use: PARENT with schoolId' }),
  N(ANY, /^\/api\/access(\/|$)/, { note: 'RBAC API: SCHOOL_ADMIN|SUPER_ADMIN + access.manage (except /me); login: access.login.manage' }),
  N(ANY, /^\/api\/super-admin\/features(\/|$)/, { note: 'RBAC feature control (SUPER_ADMIN)' }),
];
type Rule = { feature: string; perm: string; note?: string; inline?: string };
function ruleFor(method: string, canon: string): Rule | null {
  const b = findRouteBinding(method, canon);
  if (!b) return null;
  const n = NOTES.filter((x) => x.m.test(method) && x.p.test(canon));
  const extra = [b.note, ...n.map((x) => x.note)].filter(Boolean).join('; ');
  return {
    feature: b.feature || 'UNGATED', perm: b.permission || '-',
    note: extra || undefined, inline: n.map((x) => x.inline).filter(Boolean).join('; ') || undefined,
  };
}
void getPermission;

type Row = { method: string; path: string; aliases: string[]; roles: string; anon: boolean; odd: string[]; rule: Rule };
const grouped = new Map<string, Row>();
const unmapped: string[] = [];

for (const [key, r] of Object.entries(results)) {
  const [method, raw] = key.split(' ');
  const canon = canonical(raw);
  const gk = `${method} ${canon}`;
  const rule = ruleFor(method, canon);
  if (!rule) { unmapped.push(key); continue; }
  const roles = Object.entries(ROLE_AB).filter(([p]) => r[p] === 'ALLOW').map(([, a]) => a).join(',') || '—';
  const odd = Object.entries(r).filter(([, o]) => !['ALLOW', 'DENY_401', 'DENY_403'].includes(o)).map(([p, o]) => `${p}:${o}`);
  const ex = grouped.get(gk);
  if (ex) {
    if (raw !== canon) ex.aliases.push(raw);
    if (ex.roles !== roles) ex.odd.push(`alias ${raw} roles=${roles}`);
  } else {
    grouped.set(gk, { method, path: canon, aliases: raw === canon ? [] : [raw], roles, anon: r.ANON === 'ALLOW', odd, rule });
  }
}

if (unmapped.length) {
  console.error('UNMAPPED ROUTES:\n' + unmapped.join('\n'));
  process.exit(1);
}

const rows = [...grouped.values()].sort((a, b) => (a.rule.feature + a.path + a.method).localeCompare(b.rule.feature + b.path + b.method));
const byFeature = new Map<string, Set<string>>();
for (const r of rows) {
  if (!byFeature.has(r.rule.feature)) byFeature.set(r.rule.feature, new Set());
  byFeature.get(r.rule.feature)!.add(r.rule.perm);
}

const esc = (s: string) => s.replace(/\|/g, '\\|');
let md = `# Route → Permission Map

Generated by \`backend/tests/tools/generate-rbac-route-map.ts\` from the P0 baseline snapshot plus reviewed
changes (\`backend/tests/fixtures/rbac-baseline.*.json\`). Bindings come from \`backend/src/rbac/catalog.ts\`
(ROUTE_BINDINGS) — the same table the runtime gate uses. Do not hand-edit; change the catalog and re-run.

**Columns**
- *Middleware roles*: roles whose request reaches the final handler through the CURRENT middleware chain
  (app mount guards, router.use guards, route guards). Captured by \`tests/rbac-baseline.test.ts\` with
  SQL disabled; SA=SUPER_ADMIN (no schoolId), AD=SCHOOL_ADMIN, T=TEACHER, S=STUDENT, P=PARENT.
- *Inline check*: role/tenant checks written inside the handler (NOT exercised by the probe; from code reading).
- *Feature / Permission*: proposed binding. \`UNGATED\` = never gated (R11 / never-gate list).
- Compatibility roles: tokens are only ever signed with the 5 base roles (login maps ADMIN/ADMINISTRATOR→SUPER_ADMIN);
  \`attendanceAuth\` additionally accepts ADMIN/PRINCIPAL literals that no token carries today.

Totals: ${Object.keys(results).length} route keys (incl. aliases) → ${rows.length} canonical method+path rows,
${[...byFeature.values()].reduce((n, s) => n + s.size, 0)} distinct permission bindings across ${byFeature.size} features (incl. UNGATED).

## Permission summary by feature

| Feature | Permissions |
| --- | --- |
${[...byFeature.entries()].sort().map(([f, s]) => `| ${f} | ${[...s].sort().join(', ')} |`).join('\n')}

## Route table

| Method | Path (+aliases) | Middleware roles | Inline check | Feature | Permission | Notes |
| --- | --- | --- | --- | --- | --- | --- |
`;
for (const r of rows) {
  const p = r.aliases.length ? `${r.path}<br><sub>${r.aliases.join('<br>')}</sub>` : r.path;
  const roles = r.anon ? 'PUBLIC' : r.roles;
  const notes = [r.rule.note, ...r.odd].filter(Boolean).join('; ');
  md += `| ${r.method} | ${esc(p)} | ${roles} | ${esc(r.rule.inline || '')} | ${r.rule.feature} | ${r.rule.perm} | ${esc(notes)} |\n`;
}

const out = path.join(ROOT, 'docs/rbac/route-permission-map.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md);
console.log(`Wrote ${path.relative(ROOT, out)}: ${rows.length} rows, ${byFeature.size} features, 0 unmapped`);
