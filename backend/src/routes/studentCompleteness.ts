import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import {
  getStudentCompletenessSummary,
  getIncompleteStudents,
  streamIncompleteStudentsCsv,
  COMPLETENESS_FIELDS,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS
} from '../services/studentCompletenessService';

const router = Router();

// Strict RBAC: Exclusively SUPER_ADMIN and SCHOOL_ADMIN. Teachers are strictly excluded.
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
    targetSchoolId = req.user.schoolId || null;
    if (!targetSchoolId) {
      res.status(403).json({ message: 'School tenant authorization required: missing school session' });
      return null;
    }
  } else if (req.user?.role === 'SUPER_ADMIN') {
    const explicitSchoolId = String(req.query.schoolId || req.headers['x-school-id'] || '').trim();
    if (!explicitSchoolId) {
      res.status(400).json({ message: 'Explicit schoolId parameter is required for Super Admin requests' });
      return null;
    }
    if (!UUID_REGEX.test(explicitSchoolId)) {
      res.status(400).json({ message: 'Invalid schoolId parameter: must be a valid UUID' });
      return null;
    }
    targetSchoolId = explicitSchoolId;
  } else {
    res.status(403).json({ message: 'Access denied: role not authorized' });
    return null;
  }

  // Verify that the selected school exists in the database
  const schoolCheck = await pool.query('SELECT id, name FROM schools WHERE id = $1', [targetSchoolId]);
  if (!schoolCheck.rows || schoolCheck.rows.length === 0) {
    res.status(404).json({ message: `Target school does not exist: ${targetSchoolId}` });
    return null;
  }

  return targetSchoolId;
}

/**
 * Helper to safely extract session and academic year filters from query params or headers.
 * Query parameters take strict precedence over background Axios interceptor headers.
 */
function extractSessionAndYearFilters(req: AuthRequest) {
  const sessionQuery = req.query.session !== undefined ? String(req.query.session).trim() : null;
  const academicYearIdQuery = req.query.academicYearId || req.query.academic_year_id || req.query.sessionId;

  const rawSession = sessionQuery !== null ? sessionQuery : String(req.headers['x-academic-session'] || '').trim();
  const rawAcademicYearId = academicYearIdQuery
    ? String(academicYearIdQuery).trim()
    : (sessionQuery !== null ? '' : String(req.headers['x-academic-year-id'] || '').trim());

  let session: string | undefined = undefined;
  if (rawSession) {
    try {
      session = decodeURIComponent(rawSession);
    } catch {
      session = rawSession;
    }
  }

  const academicYearId = rawAcademicYearId || undefined;

  return { session, academicYearId };
}

/**
 * GET /api/students/completeness/summary
 * Returns summary KPI cards & breakdown by field.
 */
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = await resolveVerifiedSchoolId(req, res);
    if (!schoolId) return;

    const { session, academicYearId } = extractSessionAndYearFilters(req);
    const classId = String(req.query.classId || req.query.class_id || '').trim();
    const sectionId = String(req.query.sectionId || req.query.section_id || '').trim();

    const data = await getStudentCompletenessSummary(schoolId, {
      session,
      academicYearId,
      classId: classId || undefined,
      sectionId: sectionId || undefined
    });

    res.json(data);
  } catch (err: any) {
    console.error('[StudentCompleteness] Failed to calculate summary:', err);
    res.status(500).json({ message: err.message || 'Failed to calculate completeness summary' });
  }
});

/**
 * GET /api/students/completeness/missing-students
 * Returns paginated students who are missing specific or any required information.
 */
router.get('/missing-students', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = await resolveVerifiedSchoolId(req, res);
    if (!schoolId) return;

    const { session, academicYearId } = extractSessionAndYearFilters(req);
    const classId = String(req.query.classId || req.query.class_id || '').trim();
    const sectionId = String(req.query.sectionId || req.query.section_id || '').trim();
    const search = String(req.query.search || '').trim();
    const missingField = String(req.query.missingField || req.query.field || 'all').trim();
    const includeOptional = req.query.includeOptional === 'true';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '25'), 10) || 25, 5000));

    const result = await getIncompleteStudents(schoolId, {
      session,
      academicYearId,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      search: search || undefined,
      missingField: missingField || undefined,
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
    console.error('[StudentCompleteness] Failed to list incomplete students:', err);
    res.status(500).json({ message: err.message || 'Failed to list incomplete students' });
  }
});

/**
 * GET /api/students/completeness/fields
 * Returns configured list of completeness fields and categories.
 */
router.get('/fields', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = await resolveVerifiedSchoolId(req, res);
    if (!schoolId) return;

    res.json({
      fields: COMPLETENESS_FIELDS,
      required: REQUIRED_FIELDS,
      optional: OPTIONAL_FIELDS
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to retrieve field catalog' });
  }
});

/**
 * GET /api/students/completeness/export
 * Streams unpaginated incomplete students formatted directly as a CSV response.
 */
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = await resolveVerifiedSchoolId(req, res);
    if (!schoolId) return;

    const { session, academicYearId } = extractSessionAndYearFilters(req);
    const classId = String(req.query.classId || '').trim();
    const sectionId = String(req.query.sectionId || '').trim();
    const missingField = String(req.query.missingField || 'all').trim();
    const search = String(req.query.search || '').trim();
    const includeOptional = req.query.includeOptional === 'true';

    await streamIncompleteStudentsCsv(
      schoolId,
      {
        session,
        academicYearId,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        search: search || undefined,
        missingField: missingField || undefined,
        includeOptional
      },
      req,
      res
    );
  } catch (err: any) {
    console.error('[StudentCompleteness] Export generation failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'Export generation failed' });
    }
  }
});

export default router;
