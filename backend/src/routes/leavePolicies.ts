import { Router, Response } from 'express';
import { AuthRequest, requireRoles } from '../middleware/auth';
import { pool, isPostgresConfigured } from '../db';
import { fastCache } from '../utils/cache';

const router = Router();

// Allow SCHOOL_ADMIN and SUPER_ADMIN to manage; TEACHER can view
router.use(requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'));
const adminOnly = requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN');

export interface LeavePolicyRecord {
  id: string;
  school_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  days_count: number;
  accrual_cycle: 'YEARLY' | 'HALF_YEARLY';
  applicable_to: 'TEACHER' | 'STAFF' | 'STUDENT' | 'ALL';
  paid: boolean;
  carry_forward: boolean;
  max_carry_forward_days?: number;
  requires_document: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// In-memory fallback store
let memLeavePolicies: LeavePolicyRecord[] = [];

let tableInitialized = false;
async function ensureLeavePoliciesTable() {
  if (tableInitialized || !isPostgresConfigured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50),
        description TEXT,
        days_count NUMERIC(5, 1) NOT NULL DEFAULT 10,
        accrual_cycle VARCHAR(30) NOT NULL DEFAULT 'YEARLY',
        applicable_to VARCHAR(50) NOT NULL DEFAULT 'ALL',
        paid BOOLEAN NOT NULL DEFAULT TRUE,
        carry_forward BOOLEAN NOT NULL DEFAULT FALSE,
        max_carry_forward_days NUMERIC(5, 1) DEFAULT 0,
        requires_document BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_leave_policies_school ON leave_policies(school_id);
    `);
    tableInitialized = true;
  } catch (err) {
    console.warn('[LeavePolicies] Could not ensure leave_policies table:', err);
  }
}

const getEffectiveSid = (req: AuthRequest): string => {
  return req.user?.schoolId || '00000000-0000-0000-0000-000000000001';
};

/**
 * GET /api/leave-policies
 * Returns all dynamic leave policies created for the school.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const cacheKey = `leave_policies:${sid}`;

  try {
    await ensureLeavePoliciesTable();

    if (isPostgresConfigured) {
      const q = await pool.query(
        `SELECT 
          id,
          school_id,
          name,
          code,
          description,
          days_count::float AS days_count,
          accrual_cycle,
          applicable_to,
          paid,
          carry_forward,
          max_carry_forward_days::float AS max_carry_forward_days,
          requires_document,
          is_active,
          created_at,
          updated_at
        FROM leave_policies
        WHERE school_id = $1
        ORDER BY created_at DESC, name ASC`,
        [sid]
      );

      const policies: LeavePolicyRecord[] = q.rows;
      fastCache.set(cacheKey, policies, 30);
      return res.json({
        success: true,
        data: policies,
        stats: {
          total: policies.length,
          yearly: policies.filter(p => p.accrual_cycle === 'YEARLY').length,
          halfYearly: policies.filter(p => p.accrual_cycle === 'HALF_YEARLY').length,
          active: policies.filter(p => p.is_active).length,
          paid: policies.filter(p => p.paid).length
        }
      });
    }

    // Fallback in-memory
    const memForSchool = memLeavePolicies.filter(p => p.school_id === sid);
    return res.json({
      success: true,
      data: memForSchool,
      stats: {
        total: memForSchool.length,
        yearly: memForSchool.filter(p => p.accrual_cycle === 'YEARLY').length,
        halfYearly: memForSchool.filter(p => p.accrual_cycle === 'HALF_YEARLY').length,
        active: memForSchool.filter(p => p.is_active).length,
        paid: memForSchool.filter(p => p.paid).length
      }
    });
  } catch (err: any) {
    console.error('[LeavePolicies] Error fetching leave policies:', err);
    return res.status(500).json({ success: false, message: err.message || 'Unable to fetch leave policies' });
  }
});

/**
 * POST /api/leave-policies
 * Creates a new dynamic leave policy with custom days count and accrual cycle (YEARLY / HALF_YEARLY).
 */
router.post('/', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const cacheKey = `leave_policies:${sid}`;
  const {
    name,
    code,
    description,
    days_count,
    accrual_cycle,
    applicable_to,
    paid,
    carry_forward,
    max_carry_forward_days,
    requires_document,
    is_active
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Leave policy name is required' });
  }

  const daysNum = Number(days_count);
  if (isNaN(daysNum) || daysNum <= 0) {
    return res.status(400).json({ success: false, message: 'Valid leave days count must be greater than 0' });
  }

  const cycle = (accrual_cycle === 'HALF_YEARLY') ? 'HALF_YEARLY' : 'YEARLY';
  const role = ['TEACHER', 'STAFF', 'STUDENT', 'ALL'].includes(applicable_to) ? applicable_to : 'ALL';

  try {
    await ensureLeavePoliciesTable();

    if (isPostgresConfigured) {
      // Check for duplicate name in the same school
      const dup = await pool.query(
        'SELECT id FROM leave_policies WHERE school_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))',
        [sid, name]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        return res.status(409).json({ success: false, message: `A leave policy named "${name}" already exists` });
      }

      const q = await pool.query(
        `INSERT INTO leave_policies (
          school_id,
          name,
          code,
          description,
          days_count,
          accrual_cycle,
          applicable_to,
          paid,
          carry_forward,
          max_carry_forward_days,
          requires_document,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING 
          id,
          school_id,
          name,
          code,
          description,
          days_count::float AS days_count,
          accrual_cycle,
          applicable_to,
          paid,
          carry_forward,
          max_carry_forward_days::float AS max_carry_forward_days,
          requires_document,
          is_active,
          created_at,
          updated_at`,
        [
          sid,
          name.trim(),
          code ? code.trim().toUpperCase() : null,
          description ? description.trim() : null,
          daysNum,
          cycle,
          role,
          paid !== false,
          carry_forward === true,
          Number(max_carry_forward_days) || 0,
          requires_document === true,
          is_active !== false
        ]
      );

      fastCache.delete(cacheKey);
      return res.status(201).json({ success: true, data: q.rows[0], message: 'Leave policy created successfully' });
    }

    // In-memory fallback
    const newPolicy: LeavePolicyRecord = {
      id: `lp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      school_id: sid,
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : null,
      description: description ? description.trim() : null,
      days_count: daysNum,
      accrual_cycle: cycle,
      applicable_to: role,
      paid: paid !== false,
      carry_forward: carry_forward === true,
      max_carry_forward_days: Number(max_carry_forward_days) || 0,
      requires_document: requires_document === true,
      is_active: is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memLeavePolicies.unshift(newPolicy);
    return res.status(201).json({ success: true, data: newPolicy, message: 'Leave policy created successfully' });
  } catch (err: any) {
    console.error('[LeavePolicies] Error creating leave policy:', err);
    return res.status(500).json({ success: false, message: err.message || 'Unable to create leave policy' });
  }
});

/**
 * PUT /api/leave-policies/:id
 * Updates an existing leave policy.
 */
router.put('/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const cacheKey = `leave_policies:${sid}`;
  const { id } = req.params;
  const {
    name,
    code,
    description,
    days_count,
    accrual_cycle,
    applicable_to,
    paid,
    carry_forward,
    max_carry_forward_days,
    requires_document,
    is_active
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Leave policy name is required' });
  }

  const daysNum = Number(days_count);
  if (isNaN(daysNum) || daysNum <= 0) {
    return res.status(400).json({ success: false, message: 'Valid leave days count must be greater than 0' });
  }

  const cycle = (accrual_cycle === 'HALF_YEARLY') ? 'HALF_YEARLY' : 'YEARLY';
  const role = ['TEACHER', 'STAFF', 'STUDENT', 'ALL'].includes(applicable_to) ? applicable_to : 'ALL';

  try {
    await ensureLeavePoliciesTable();

    if (isPostgresConfigured) {
      // Check for duplicate name with other policies in this school
      const dup = await pool.query(
        'SELECT id FROM leave_policies WHERE school_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND id != $3',
        [sid, name, id]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        return res.status(409).json({ success: false, message: `Another leave policy named "${name}" already exists` });
      }

      const q = await pool.query(
        `UPDATE leave_policies SET
          name = $1,
          code = $2,
          description = $3,
          days_count = $4,
          accrual_cycle = $5,
          applicable_to = $6,
          paid = $7,
          carry_forward = $8,
          max_carry_forward_days = $9,
          requires_document = $10,
          is_active = $11,
          updated_at = NOW()
        WHERE id = $12 AND school_id = $13
        RETURNING 
          id,
          school_id,
          name,
          code,
          description,
          days_count::float AS days_count,
          accrual_cycle,
          applicable_to,
          paid,
          carry_forward,
          max_carry_forward_days::float AS max_carry_forward_days,
          requires_document,
          is_active,
          created_at,
          updated_at`,
        [
          name.trim(),
          code ? code.trim().toUpperCase() : null,
          description ? description.trim() : null,
          daysNum,
          cycle,
          role,
          paid !== false,
          carry_forward === true,
          Number(max_carry_forward_days) || 0,
          requires_document === true,
          is_active !== false,
          id,
          sid
        ]
      );

      if (!q.rowCount || q.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Leave policy not found' });
      }

      fastCache.delete(cacheKey);
      return res.json({ success: true, data: q.rows[0], message: 'Leave policy updated successfully' });
    }

    // In-memory fallback
    const idx = memLeavePolicies.findIndex(p => p.id === id && p.school_id === sid);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Leave policy not found' });
    }
    memLeavePolicies[idx] = {
      ...memLeavePolicies[idx],
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : null,
      description: description ? description.trim() : null,
      days_count: daysNum,
      accrual_cycle: cycle,
      applicable_to: role,
      paid: paid !== false,
      carry_forward: carry_forward === true,
      max_carry_forward_days: Number(max_carry_forward_days) || 0,
      requires_document: requires_document === true,
      is_active: is_active !== false,
      updated_at: new Date().toISOString()
    };
    return res.json({ success: true, data: memLeavePolicies[idx], message: 'Leave policy updated successfully' });
  } catch (err: any) {
    console.error('[LeavePolicies] Error updating leave policy:', err);
    return res.status(500).json({ success: false, message: err.message || 'Unable to update leave policy' });
  }
});

/**
 * PATCH /api/leave-policies/:id/toggle-status
 * Quickly toggle policy active/inactive status.
 */
router.patch('/:id/toggle-status', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const cacheKey = `leave_policies:${sid}`;
  const { id } = req.params;

  try {
    await ensureLeavePoliciesTable();

    if (isPostgresConfigured) {
      const q = await pool.query(
        `UPDATE leave_policies 
         SET is_active = NOT is_active, updated_at = NOW() 
         WHERE id = $1 AND school_id = $2 
         RETURNING id, is_active, name`,
        [id, sid]
      );
      if (!q.rowCount || q.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Leave policy not found' });
      }
      fastCache.delete(cacheKey);
      return res.json({
        success: true,
        data: q.rows[0],
        message: `Leave policy "${q.rows[0].name}" is now ${q.rows[0].is_active ? 'Active' : 'Inactive'}`
      });
    }

    const item = memLeavePolicies.find(p => p.id === id && p.school_id === sid);
    if (!item) return res.status(404).json({ success: false, message: 'Leave policy not found' });
    item.is_active = !item.is_active;
    item.updated_at = new Date().toISOString();
    return res.json({
      success: true,
      data: item,
      message: `Leave policy "${item.name}" is now ${item.is_active ? 'Active' : 'Inactive'}`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/leave-policies/:id
 * Deletes a leave policy.
 */
router.delete('/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const cacheKey = `leave_policies:${sid}`;
  const { id } = req.params;

  try {
    await ensureLeavePoliciesTable();

    if (isPostgresConfigured) {
      const q = await pool.query(
        'DELETE FROM leave_policies WHERE id = $1 AND school_id = $2 RETURNING id, name',
        [id, sid]
      );
      if (!q.rowCount || q.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Leave policy not found' });
      }
      fastCache.delete(cacheKey);
      return res.json({ success: true, message: `Leave policy "${q.rows[0].name}" deleted successfully` });
    }

    const idx = memLeavePolicies.findIndex(p => p.id === id && p.school_id === sid);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Leave policy not found' });
    }
    const removed = memLeavePolicies.splice(idx, 1)[0];
    return res.json({ success: true, message: `Leave policy "${removed.name}" deleted successfully` });
  } catch (err: any) {
    console.error('[LeavePolicies] Error deleting leave policy:', err);
    return res.status(500).json({ success: false, message: err.message || 'Unable to delete leave policy' });
  }
});

export default router;
