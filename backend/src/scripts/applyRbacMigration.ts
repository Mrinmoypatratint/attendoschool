/**
 * Applies ONLY database/migrations/051_rbac_feature_control.sql, in one transaction, then verifies it.
 *
 * Why not `npm run db:migrate`: the production database has no `schema_migrations` table (migrations were
 * applied by hand), so the runner would try to replay every migration. 051 is additive and idempotent
 * (CREATE TABLE IF NOT EXISTS / ON CONFLICT), so running this twice is safe.
 *
 * Runs automatically on every production deploy (.github/workflows/deploy.yml, after the backend build and
 * before the PM2 reload) — idempotent, so new plans/catalog keys are seeded on each deploy.
 *
 * Manual usage (from backend/, with the production DATABASE_URL / SUPABASE_DATABASE_URL in backend/.env):
 *   npx tsx src/scripts/applyRbacMigration.ts            # dry run: shows what exists, changes nothing
 *   npx tsx src/scripts/applyRbacMigration.ts --apply    # applies 051 and verifies
 */
import fs from 'fs';
import path from 'path';
import { pool, isPostgresConfigured } from '../db';

const FILE = path.resolve(__dirname, '../../../database/migrations/051_rbac_feature_control.sql');
const TABLES = ['plan_features', 'school_feature_overrides', 'school_role_permissions', 'user_permission_overrides', 'user_login_controls', 'access_versions', 'access_audit_log'];

async function present(): Promise<string[]> {
  const r = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])`, [TABLES]);
  return r.rows.map((x: any) => x.table_name);
}

async function main() {
  if (!isPostgresConfigured) {
    // Firestore-only deployments have no SQL store: RBAC then runs on legacy defaults (see accessStore.ts).
    console.warn('[051] SQL is not configured (DATABASE_URL / SUPABASE_DATABASE_URL) — skipping RBAC schema.');
    return;
  }
  const apply = process.argv.includes('--apply');
  const prereq = await pool.query(`SELECT to_regclass('public.subscription_plans') sp, to_regclass('public.permission_definitions') pd, to_regclass('public.platform_settings') ps`);
  const missing = Object.entries(prereq.rows[0]).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Prerequisite tables missing (${missing.join(', ')}); apply migrations 018/019/039 first.`);
  const before = await present();
  console.log(`[051] RBAC tables present before: ${before.length}/${TABLES.length}`);
  if (!apply) { console.log('[051] Dry run only. Re-run with --apply to apply.'); return; }

  const sql = fs.readFileSync(FILE, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  const after = await present();
  const seeded = await pool.query(`SELECT COUNT(*)::int n FROM plan_features`);
  console.log(`[051] Applied. RBAC tables present: ${after.length}/${TABLES.length}; plan_features rows: ${seeded.rows[0].n}`);
  if (after.length !== TABLES.length) throw new Error('Verification failed: not all RBAC tables exist.');
  console.log('[051] Done. /api/health shows "rbac": "READY" within ~60 s (or after pm2 reload).');
}

main()
  .catch((e) => { console.error('[051] FAILED:', e?.code || '', e?.message || e); process.exitCode = 1; })
  .finally(() => pool.end().catch(() => undefined));
