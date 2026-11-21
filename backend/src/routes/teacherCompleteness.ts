import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { canonicalSchoolId } from '../utils/tenant';
import {
  getTeacherCompletenessSummary,
  getIncompleteTeachers,
  streamIncompleteTeachersCsv,
  TEACHER_COMPLETENESS_FIELDS,
  REQUIRED_TEACHER_FIELDS,
  OPTIONAL_TEACHER_FIELDS
} from '../services/teacherCompletenessService';

const router = Router();

// Strict RBAC: Exclusively SUPER_ADMIN and SCHOOL_ADMIN. Teachers, students, and parents are strictly excluded.
router.use(requireAuth, requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'));

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves and verifies the target school ID.
 * - For SCHOOL_ADMIN: Always uses req.user.schoolId from the authenticated JWT session.
 *   Strictly ignores any query parameters or headers trying to override the schoolId.
 * - For SUPER_ADMIN: Requires an explicit, valid UUID schoolId via ?schoolId= or X-School-Id header.
 * - Verifies the school actually exists in the database.
 */
async function resolveVerifiedSchoolId(req: AuthRequest, res: Response): Promise<string | null> {
  let targetSchoolId: string | null = null;

  if (req.user?.role === 'SCHOOL_ADMIN') {
    const rawSchoolId = req.user.schoolId || (req.user as any).school_id || null;
    if (!rawSchoolId) {
      res.status(403).json({ message: 'School tenant authorization required: missing school session' });
      return null;
    }
    targetSchoolId = canonicalSchoolId(rawSchoolId) || rawSchoolId;
  } else if (req.user?.role === 'SUPER_ADMIN') {
    const explicitSchoolId = String(req.query.schoolId || req.headers['x-school-id'] || '').trim();
    if (!explicitSchoolId) {
      res.status(400).json({ message: 'Explicit schoolId parameter is required for Super Admin requests' });
      return null;
    }
    const canonId = canonicalSchoolId(explicitSchoolId) || explicitSchoolId;
    if (!UUID_REGEX.test(canonId)) {
      res.status(400).json({ message: 'Invalid schoolId parameter: must be a valid UUID' });
      return null;
    }
    targetSchoolId = canonId;
  } else {
    res.status(403).json({ message: 'Access denied: role not authorized' });
    return null;
  }

  // Verify that the selected school exists in the database
  let schoolCheck;
  if (UUID_REGEX.test(targetSchoolId)) {
    schoolCheck = await pool.query('SELECT id, name FROM schools WHERE id = $1', [targetSchoolId]);
  } else {
    schoolCheck = await pool.query('SELECT id, name FROM schools WHERE code = $1 OR id::text = $1', [targetSchoolId]);
  }

  if (!schoolCheck.rows || schoolCheck.rows.length === 0) {
    res.status(404).json({ message: `Target school does not exist: ${targetSchoolId}` });
    return null;
  }

  return schoolCheck.rows[0].id;
}

/**
 * GET /api/teachers/completeness/summary
 * Returns summary KPI cards & breakdown by field.
 */
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = await resolveVerifiedSchoolId(req, res);
    if (!schoolId) return;

    const gender = String(req.query.gender || '').trim();
    const designation = String(req.query.designation || '').trim();

    const data = await getTeacherCompletenessSummary(schoolId, {
      gender: gender || undefined,
      designation: designation || undefined
    });

    res.json(data);
  } catch (err: any) {
    console.error('[TeacherCompleteness] Failed to calculate summary:', err);
    res.status(500).json({ message: err.message || 'Failed to calculate completeness summary' });
  }
});

/**
 * GET /api/teachers/completeness/missing-teachers
 * Returns paginated teachers who are missing specific or any required information.
 */
router.get('/missing-teachers', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = await resolveVerifiedSchoolId(req, res);
    if (!schoolId) return;

    const search = String(req.query.search || '').trim();
    const missingField = String(req.query.missingField || req.query.field || 'all').trim();
    const gender = String(req.query.gender || '').trim();
    const designation = String(req.query.designation || '').trim();
    const includeOptional = req.query.includeOptional === 'true';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '25'), 10) || 25, 5000));

    const result = await getIncompleteTeachers(schoolId, {
      search: search || undefined,
      missingField: missingField || undefined,
      gender: gender || undefined,
      designation: designation || undefined,
      includeOptional,
      page,
      limit
    });

    res.setHeader('X-Total-Count', String(result.pagination.total));
    res.setHeader('X-Page', String(result.pagination.page));
    res.setHeader('X-Per-Page', String(result.pagination.limit));
    res.setHeader('X-Total-Pages', String(result.pagination.totalPages));

    res.json(result);
  } catch (err: any) {
    console.error('[TeacherCompleteness] Failed to load missing teachers:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch missing teachers' });
  }
});

/**
 * GET /api/teachers/completeness/fields
 * Returns configured completeness fields definitions for UI reference.
 */
router.get('/fields', async (_req: AuthRequest, res: Response) => {
  res.json({
    fields: TEACHER_COMPLETENESS_FIELDS,
    requiredFields: REQUIRED_TEACHER_FIELDS,
    optionalFields: OPTIONAL_TEACHER_FIELDS
  });
});

/**
 * GET /api/teachers/completeness/export
 * Streams unpaginated incomplete teachers as a CSV file attachment.
 */
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = await resolveVerifiedSchoolId(req, res);
    if (!schoolId) return;

    const search = String(req.query.search || '').trim();
    const missingField = String(req.query.missingField || req.query.field || 'all').trim();
    const gender = String(req.query.gender || '').trim();
    const designation = String(req.query.designation || '').trim();
    const includeOptional = req.query.includeOptional === 'true';

    await streamIncompleteTeachersCsv(
      schoolId,
      {
        search: search || undefined,
        missingField: missingField || undefined,
        gender: gender || undefined,
        designation: designation || undefined,
        includeOptional
      },
      req,
      res
    );
  } catch (err: any) {
    console.error('[TeacherCompleteness] Failed to stream CSV export:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'Failed to stream CSV export' });
    }
  }
});

export default router;
