/**
 * Read-only lookup of the people an admin can manage (users of one school).
 * Source: SQL `users` (+ `students` for display names). ⚠️ ASSUMPTION: SQL is the source of truth
 * for school users in production; Firestore-only users are not listed (documented in docs/rbac/ROLLOUT.md).
 */
import { pool, isPostgresConfigured } from '../db';
import { AccessStoreUnavailableError } from './accessStore';

export type Principal = { id: string; name: string; email: string | null; role: string; isActive: boolean; createdAt: string | null; detail?: string | null };

export interface PrincipalDirectory {
  schoolExists(schoolId: string): Promise<boolean>;
  getPrincipal(schoolId: string, role: string, id: string): Promise<Principal | null>;
  listPrincipals(schoolId: string, role: string, search: string, page: number, pageSize: number): Promise<{ items: Principal[]; total: number }>;
  listActiveAdmins(schoolId: string): Promise<Principal[]>;
  getOwnerAdminId(schoolId: string): Promise<string | null>;
  countByRole(schoolId: string, role: string): Promise<number>;
}

function requireSql() { if (!isPostgresConfigured) throw new AccessStoreUnavailableError('User directory requires SQL.'); }
const map = (r: any): Principal => ({
  id: String(r.id), name: r.name || r.email || String(r.id), email: r.email || null, role: r.role,
  isActive: r.is_active !== false, createdAt: r.created_at ? new Date(r.created_at).toISOString() : null, detail: r.detail || null,
});

export class SqlPrincipalDirectory implements PrincipalDirectory {
  async schoolExists(schoolId: string) {
    requireSql();
    const r = await pool.query(`SELECT 1 FROM schools WHERE id::text=$1 OR LOWER(code)=LOWER($1) LIMIT 1`, [schoolId]);
    return (r.rowCount || 0) > 0;
  }
  async getPrincipal(schoolId: string, role: string, id: string) {
    requireSql();
    const r = await pool.query(
      `SELECT u.id, COALESCE(st.name,u.name) AS name, u.email, u.role, u.is_active, u.created_at,
              CASE WHEN st.id IS NOT NULL THEN COALESCE(st.admission_number,'') ELSE NULL END AS detail
         FROM users u LEFT JOIN students st ON st.user_id=u.id
        WHERE u.id::text=$1 AND u.school_id::text=$2 AND u.role::text=$3 LIMIT 1`, [id, schoolId, role]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }
  async listPrincipals(schoolId: string, role: string, search: string, page: number, pageSize: number) {
    requireSql();
    const params: any[] = [schoolId, role];
    let where = `u.school_id::text=$1 AND u.role::text=$2`;
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND (LOWER(COALESCE(st.name,u.name)) LIKE $3 OR LOWER(u.email) LIKE $3 OR LOWER(COALESCE(st.admission_number,'')) LIKE $3)`;
    }
    const base = `FROM users u LEFT JOIN students st ON st.user_id=u.id WHERE ${where}`;
    const total = await pool.query(`SELECT COUNT(*)::int AS n ${base}`, params);
    params.push(pageSize, (page - 1) * pageSize);
    const r = await pool.query(
      `SELECT u.id, COALESCE(st.name,u.name) AS name, u.email, u.role, u.is_active, u.created_at, st.admission_number AS detail ${base}
       ORDER BY COALESCE(st.name,u.name) NULLS LAST, u.email LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { total: Number(total.rows[0]?.n || 0), items: r.rows.map(map) };
  }
  async listActiveAdmins(schoolId: string) {
    requireSql();
    const r = await pool.query(`SELECT id,name,email,role,is_active,created_at FROM users WHERE school_id::text=$1 AND role='SCHOOL_ADMIN' AND is_active=TRUE ORDER BY created_at`, [schoolId]);
    return r.rows.map(map);
  }
  /** Owner admin = earliest-created SCHOOL_ADMIN (same rule superAdmin.ts uses for the school's admin). */
  async getOwnerAdminId(schoolId: string) {
    requireSql();
    const r = await pool.query(`SELECT id FROM users WHERE school_id::text=$1 AND role='SCHOOL_ADMIN' ORDER BY created_at ASC, id ASC LIMIT 1`, [schoolId]);
    return r.rows[0] ? String(r.rows[0].id) : null;
  }
  async countByRole(schoolId: string, role: string) {
    requireSql();
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE school_id::text=$1 AND role::text=$2 AND is_active=TRUE`, [schoolId, role]);
    return Number(r.rows[0]?.n || 0);
  }
}

let current: PrincipalDirectory = new SqlPrincipalDirectory();
export function getPrincipalDirectory(): PrincipalDirectory { return current; }
export function setPrincipalDirectory(d: PrincipalDirectory) { current = d; }
