import { Router, Response } from 'express';
import { AuthRequest, requireRoles } from '../middleware/auth';
import { pool, isPostgresConfigured } from '../db';
import { fastCache } from '../utils/cache';

const router = Router();

// Allow SCHOOL_ADMIN, SUPER_ADMIN, and TEACHER to read; require admin to modify
router.use(requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'));
const adminOnly = requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN');

export interface DesignationRecord {
  id: string;
  school_id: string;
  title: string;
  code?: string | null;
  category: 'Teaching' | 'Leadership' | 'Administrative' | 'Support';
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  teacher_count?: number;
}

// In-memory fallback store for development or if database is temporarily unavailable
let memDesignations: DesignationRecord[] = [];

let tableInitialized = false;
async function ensureDesignationsTable() {
  if (tableInitialized || !isPostgresConfigured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS designations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL,
        title VARCHAR(150) NOT NULL,
        code VARCHAR(50),
        category VARCHAR(50) DEFAULT 'Teaching',
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_designations_school ON designations(school_id);
    `);
    tableInitialized = true;
  } catch (err) {
    console.warn('[Designations] Could not ensure designations table:', err);
  }
}

const getEffectiveSid = (req: AuthRequest): string => {
  return req.user?.schoolId || '00000000-0000-0000-0000-000000000001';
};

/**
 * GET /api/designations
 * Return ONLY designations created by the user for the requesting school.
 * Zero hardcoded or pre-seeded entries.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const cacheKey = `designations:${sid}`;

  try {
    await ensureDesignationsTable();

    if (isPostgresConfigured) {
      const q = await pool.query(
        `SELECT 
           d.*,
           COALESCE(tc.count, 0)::int as teacher_count
         FROM designations d
         LEFT JOIN (
           SELECT 
             LOWER(TRIM(tp.designation)) as desig_name,
             COUNT(*)::int as count
           FROM teacher_profiles tp
           JOIN users u ON u.id = tp.user_id
           WHERE u.school_id = $1 AND u.is_active = true
           GROUP BY LOWER(TRIM(tp.designation))
         ) tc ON LOWER(TRIM(d.title)) = tc.desig_name
         WHERE d.school_id = $1
         ORDER BY d.is_active DESC, d.category ASC, d.title ASC`,
        [sid]
      );

      fastCache.set(cacheKey, q.rows || [], 30);
      return res.json(q.rows || []);
    }
  } catch (err) {
    console.error('[Designations] Error fetching designations from DB:', err);
  }

  // Fallback to in-memory store (strictly user-created)
  const schoolDesigs = memDesignations.filter(d => d.school_id === sid);
  return res.json(schoolDesigs);
});

/**
 * POST /api/designations
 * Create a new custom designation defined by the school admin
 */
router.post('/', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const { title, code, category, description, is_active } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Designation title is required.' });
  }

  const cleanTitle = String(title).trim();
  const cleanCode = code ? String(code).trim().toUpperCase() : null;
  const cleanCategory = ['Teaching', 'Leadership', 'Administrative', 'Support'].includes(category)
    ? category
    : 'Teaching';
  const cleanDescription = description ? String(description).trim() : null;
  const activeStatus = is_active !== false;

  await ensureDesignationsTable();

  if (isPostgresConfigured) {
    try {
      // Check for duplicate title in the same school
      const check = await pool.query(
        `SELECT id FROM designations WHERE school_id = $1 AND LOWER(TRIM(title)) = LOWER($2)`,
        [sid, cleanTitle]
      );
      if (check.rows.length > 0) {
        return res.status(409).json({ message: `A designation named "${cleanTitle}" already exists for this school.` });
      }

      const ins = await pool.query(
        `INSERT INTO designations (school_id, title, code, category, description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [sid, cleanTitle, cleanCode, cleanCategory, cleanDescription, activeStatus]
      );

      if (ins.rows[0]) {
        const created: DesignationRecord = {
          ...ins.rows[0],
          teacher_count: 0
        };
        memDesignations.push(created);
        fastCache.delete(`designations:${sid}`);
        return res.status(201).json(created);
      }
    } catch (err: any) {
      console.error('[Designations] Error creating designation in DB:', err);
      return res.status(500).json({ message: err.message || 'Database error while creating designation' });
    }
  }

  // In-memory fallback
  const duplicate = memDesignations.find(d => d.school_id === sid && d.title.toLowerCase() === cleanTitle.toLowerCase());
  if (duplicate) {
    return res.status(409).json({ message: `A designation named "${cleanTitle}" already exists for this school.` });
  }

  const fallbackRecord: DesignationRecord = {
    id: `desig-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    school_id: sid,
    title: cleanTitle,
    code: cleanCode,
    category: cleanCategory,
    description: cleanDescription,
    is_active: activeStatus,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    teacher_count: 0
  };

  memDesignations.push(fallbackRecord);
  fastCache.delete(`designations:${sid}`);
  return res.status(201).json(fallbackRecord);
});

/**
 * PUT /api/designations/:id
 * Update an existing custom designation
 */
router.put('/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const id = String(req.params.id);
  const { title, code, category, description, is_active } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Designation title cannot be empty' });
  }

  const cleanTitle = String(title).trim();
  const cleanCode = code !== undefined ? (code ? String(code).trim().toUpperCase() : null) : undefined;
  const cleanCategory = ['Teaching', 'Leadership', 'Administrative', 'Support'].includes(category)
    ? category
    : undefined;
  const cleanDescription = description !== undefined ? (description ? String(description).trim() : null) : undefined;
  const activeStatus = is_active !== undefined ? Boolean(is_active) : undefined;

  await ensureDesignationsTable();

  if (isPostgresConfigured) {
    try {
      const check = await pool.query(
        `SELECT id FROM designations WHERE school_id = $1 AND LOWER(TRIM(title)) = LOWER($2) AND id != $3`,
        [sid, cleanTitle, id]
      );
      if (check.rows.length > 0) {
        return res.status(409).json({ message: `Another designation with title "${cleanTitle}" already exists.` });
      }

      const current = await pool.query(`SELECT title FROM designations WHERE id = $1 AND school_id = $2`, [id, sid]);
      const oldTitle = current.rows[0]?.title;

      const upd = await pool.query(
        `UPDATE designations
         SET title = COALESCE($1, title),
             code = COALESCE($2, code),
             category = COALESCE($3, category),
             description = COALESCE($4, description),
             is_active = COALESCE($5, is_active),
             updated_at = NOW()
         WHERE id = $6 AND school_id = $7
         RETURNING *`,
        [cleanTitle, cleanCode, cleanCategory, cleanDescription, activeStatus, id, sid]
      );

      if (upd.rows.length === 0) {
        return res.status(404).json({ message: 'Designation not found' });
      }

      if (oldTitle && oldTitle !== cleanTitle) {
        await pool.query(
          `UPDATE teacher_profiles tp
           SET designation = $1
           FROM users u
           WHERE tp.user_id = u.id AND u.school_id = $2 AND LOWER(TRIM(tp.designation)) = LOWER(TRIM($3))`,
          [cleanTitle, sid, oldTitle]
        ).catch(() => {});
      }

      fastCache.delete(`designations:${sid}`);
      return res.json(upd.rows[0]);
    } catch (err: any) {
      console.error('[Designations] Error updating designation:', err);
      return res.status(500).json({ message: err.message || 'Database error while updating designation' });
    }
  }

  // In-memory fallback
  const idx = memDesignations.findIndex(d => d.id === id && d.school_id === sid);
  if (idx === -1) {
    return res.status(404).json({ message: 'Designation not found' });
  }

  memDesignations[idx] = {
    ...memDesignations[idx],
    title: cleanTitle,
    code: cleanCode !== undefined ? cleanCode : memDesignations[idx].code,
    category: (cleanCategory as any) || memDesignations[idx].category,
    description: cleanDescription !== undefined ? cleanDescription : memDesignations[idx].description,
    is_active: activeStatus !== undefined ? activeStatus : memDesignations[idx].is_active,
    updated_at: new Date().toISOString()
  };

  fastCache.delete(`designations:${sid}`);
  return res.json(memDesignations[idx]);
});

/**
 * DELETE /api/designations/:id
 * Delete a custom designation
 */
router.delete('/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const id = String(req.params.id);

  await ensureDesignationsTable();

  if (isPostgresConfigured) {
    try {
      const del = await pool.query(`DELETE FROM designations WHERE id = $1 AND school_id = $2 RETURNING *`, [id, sid]);
      if (del.rows.length === 0) {
        return res.status(404).json({ message: 'Designation not found' });
      }
      fastCache.delete(`designations:${sid}`);
      return res.json({ message: 'Designation deleted successfully', deleted: del.rows[0] });
    } catch (err: any) {
      console.error('[Designations] Error deleting designation:', err);
      return res.status(500).json({ message: err.message || 'Database error while deleting designation' });
    }
  }

  const beforeLen = memDesignations.length;
  memDesignations = memDesignations.filter(d => !(d.id === id && d.school_id === sid));
  if (memDesignations.length === beforeLen) {
    return res.status(404).json({ message: 'Designation not found' });
  }

  fastCache.delete(`designations:${sid}`);
  return res.json({ message: 'Designation deleted successfully' });
});

/**
 * TEACHER PROMOTIONS SYSTEM
 */
export interface TeacherPromotionRecord {
  id: string;
  school_id: string;
  teacher_id: string;
  teacher_name: string;
  employee_id?: string | null;
  email?: string | null;
  previous_position: string;
  current_position: string;
  promotion_date: string;
  notes?: string | null;
  promoted_by?: string | null;
  created_at?: string;
}

let memPromotions: TeacherPromotionRecord[] = [];

async function ensureTeacherPromotionsTable() {
  if (!isPostgresConfigured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teacher_promotions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL,
        teacher_id UUID NOT NULL,
        teacher_name VARCHAR(255) NOT NULL,
        employee_id VARCHAR(100),
        email VARCHAR(255),
        previous_position VARCHAR(255) NOT NULL,
        current_position VARCHAR(255) NOT NULL,
        promotion_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        notes TEXT,
        promoted_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_teacher_promotions_school ON teacher_promotions(school_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_promotions_teacher ON teacher_promotions(teacher_id);
    `);
  } catch (err) {
    console.warn('[Designations] Could not ensure teacher_promotions table:', err);
  }
}

/**
 * GET /api/designations/promotions
 * Get all promotions for the requesting school
 */
router.get('/promotions', async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  await ensureTeacherPromotionsTable();

  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT 
           id, school_id, teacher_id, teacher_name, employee_id, email,
           previous_position, current_position, promotion_date, notes, promoted_by, created_at
         FROM teacher_promotions 
         WHERE school_id = $1 
         ORDER BY promotion_date DESC, created_at DESC`,
        [sid]
      );
      return res.json(q.rows || []);
    } catch (err: any) {
      console.error('[Designations] Error fetching promotions:', err);
    }
  }

  const schoolPromos = memPromotions.filter(p => p.school_id === sid);
  return res.json(schoolPromos);
});

/**
 * GET /api/designations/faculty
 * Get all teachers with current designation and promotions history
 */
router.get('/faculty', async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  await ensureTeacherPromotionsTable();

  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT 
           u.id, 
           u.name, 
           u.email, 
           u.is_active,
           tp.employee_id, 
           tp.mobile, 
           tp.gender, 
           tp.joining_date, 
           COALESCE(tp.designation, 'Teacher') as designation,
           tp.class_name, 
           tp.section_name
         FROM users u
         JOIN teacher_profiles tp ON tp.user_id = u.id
         WHERE u.school_id = $1 AND u.role = 'TEACHER'
         ORDER BY u.name ASC`,
        [sid]
      );
      return res.json(q.rows || []);
    } catch (err: any) {
      console.error('[Designations] Error fetching designation faculty:', err);
    }
  }

  return res.json([]);
});

/**
 * POST /api/designations/promote
 * Promote a teacher from one designation to another
 */
router.post('/promote', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const { teacher_id, previous_position, current_position, promotion_date, notes } = req.body || {};

  if (!teacher_id || !current_position || !String(current_position).trim()) {
    return res.status(400).json({ message: 'Teacher and new position/designation are required.' });
  }

  await ensureTeacherPromotionsTable();
  await ensureDesignationsTable();

  const cleanNewPosition = String(current_position).trim();
  let cleanOldPosition = previous_position ? String(previous_position).trim() : 'Teacher';
  let teacherName = 'Teacher';
  let employeeId = '';
  let email = '';

  if (isPostgresConfigured) {
    try {
      // Look up current teacher details
      const tQ = await pool.query(
        `SELECT u.name, u.email, tp.employee_id, tp.designation 
         FROM users u 
         LEFT JOIN teacher_profiles tp ON tp.user_id = u.id 
         WHERE u.id = $1 AND u.school_id = $2`,
        [teacher_id, sid]
      );

      if (tQ.rows.length > 0) {
        teacherName = tQ.rows[0].name || teacherName;
        employeeId = tQ.rows[0].employee_id || '';
        email = tQ.rows[0].email || '';
        if (!previous_position && tQ.rows[0].designation) {
          cleanOldPosition = tQ.rows[0].designation;
        }
      }

      // Update teacher profile designation
      await pool.query(
        `UPDATE teacher_profiles SET designation = $1 WHERE user_id = $2`,
        [cleanNewPosition, teacher_id]
      );

      // Insert promotion record
      const promoDate = promotion_date ? new Date(promotion_date) : new Date();
      const ins = await pool.query(
        `INSERT INTO teacher_promotions 
           (school_id, teacher_id, teacher_name, employee_id, email, previous_position, current_position, promotion_date, notes, promoted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          sid,
          teacher_id,
          teacherName,
          employeeId,
          email,
          cleanOldPosition,
          cleanNewPosition,
          promoDate,
          notes ? String(notes).trim() : null,
          req.user?.email || 'Admin'
        ]
      );

      fastCache.delete(`designations:${sid}`);
      return res.status(201).json(ins.rows[0]);
    } catch (err: any) {
      console.error('[Designations] Error promoting teacher:', err);
      return res.status(500).json({ message: err.message || 'Error processing promotion' });
    }
  }

  // Fallback memory
  const promo: TeacherPromotionRecord = {
    id: `promo-${Date.now()}`,
    school_id: sid,
    teacher_id,
    teacher_name: teacherName,
    employee_id: employeeId,
    email,
    previous_position: cleanOldPosition,
    current_position: cleanNewPosition,
    promotion_date: promotion_date || new Date().toISOString(),
    notes: notes || null,
    promoted_by: req.user?.email || 'Admin',
    created_at: new Date().toISOString()
  };
  memPromotions.unshift(promo);
  fastCache.delete(`designations:${sid}`);
  return res.status(201).json(promo);
});

/**
 * DELETE /api/designations/promotions/:id
 * Remove a promotion record
 */
router.delete('/promotions/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  const sid = getEffectiveSid(req);
  const id = String(req.params.id);

  await ensureTeacherPromotionsTable();

  if (isPostgresConfigured) {
    try {
      await pool.query(`DELETE FROM teacher_promotions WHERE id = $1 AND school_id = $2`, [id, sid]);
      return res.json({ message: 'Promotion record deleted successfully' });
    } catch (err: any) {
      console.error('[Designations] Error deleting promotion record:', err);
      return res.status(500).json({ message: err.message || 'Error deleting promotion record' });
    }
  }

  memPromotions = memPromotions.filter(p => !(p.id === id && p.school_id === sid));
  return res.json({ message: 'Promotion record deleted successfully' });
});

export default router;
