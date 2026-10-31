import { pool, isPostgresConfigured } from '../db';
import { Router, Response } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import * as mentorSvc from '../services/mentorService';
import * as attendanceSvc from '../services/attendanceReportService';

const router = Router();

// Require authenticated user with active school on mentor routes
router.use(['/admin/mentors', '/teacher/mentor'], requireAuth, (req: AuthRequest, res: Response, next) => {
  if (!req.user?.schoolId) {
    return res.status(403).json({ message: 'Institutional school context required' });
  }
  next();
});

// ──────────────────────────────────────────
// SCHOOL ADMIN MENTOR MANAGEMENT ENDPOINTS
// ──────────────────────────────────────────

// GET /api/admin/mentors - List all class-sections and assigned mentors for the school
router.get('/admin/mentors', requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const list = await mentorSvc.getAllClassMentors(req.user!.schoolId!, req.query);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to load class teachers' });
  }
});

// POST /api/admin/mentors - Assign or change mentor for a class-section
router.post('/admin/mentors', requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, classId, section_id, sectionId, teacher_id, teacherId } = req.body || {};
    const cId = String(class_id || classId || '').trim();
    const sId = String(section_id || sectionId || '').trim();
    const tId = String(teacher_id || teacherId || '').trim();

    if (!cId || !sId || !tId) {
      return res.status(400).json({ message: 'class_id, section_id, and teacher_id are required' });
    }

    const data = await mentorSvc.assignClassMentor(req.user!.schoolId!, cId, sId, tId);
    res.json({ success: true, message: 'Class Teacher assigned successfully', data });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to assign class teacher' });
  }
});

// DELETE /api/admin/mentors - Remove mentor assignment from a class-section
router.delete('/admin/mentors', requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, classId, section_id, sectionId } = req.body || req.query || {};
    const cId = String(class_id || classId || '').trim();
    const sId = String(section_id || sectionId || '').trim();

    if (!cId || !sId) {
      return res.status(400).json({ message: 'class_id and section_id are required' });
    }

    const data = await mentorSvc.removeClassMentor(req.user!.schoolId!, cId, sId);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to remove class teacher' });
  }
});

// ──────────────────────────────────────────
// TEACHER MENTOR WORKSPACE ENDPOINTS
// ──────────────────────────────────────────

// GET /api/teacher/mentor/my-classes - List sections mentored by logged-in teacher
router.get('/teacher/mentor/my-classes', requireRoles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const list = await mentorSvc.getMentoredClasses(req.user!.schoolId!, req.user!.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to load mentored classes' });
  }
});

// GET /api/teacher/mentor/teacher-assignments - Get subject teachers & assignment count for mentored section
router.get('/teacher/mentor/teacher-assignments', requireRoles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const classId = String(req.query.class_id || req.query.classId || '').trim();
    const sectionId = String(req.query.section_id || req.query.sectionId || '').trim();
    const fromDate = String(req.query.from || '').trim() || undefined;
    const toDate = String(req.query.to || '').trim() || undefined;

    if (!classId || !sectionId) {
      return res.status(400).json({ message: 'class_id and section_id query parameters are required' });
    }

    const isAdmin = req.user!.role === 'SCHOOL_ADMIN' || req.user!.role === 'SUPER_ADMIN';
    const list = await mentorSvc.getMentorTeacherAssignmentsOverview(
      req.user!.schoolId!,
      req.user!.id,
      classId,
      sectionId,
      fromDate,
      toDate,
      isAdmin
    );
    res.json(list);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ message: err.message || 'Unable to fetch teacher assignments overview', code: err.code });
  }
});

// GET /api/teacher/mentor/permissions - Get subject teacher permissions for a mentored section
router.get('/teacher/mentor/permissions', requireRoles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const classId = String(req.query.class_id || req.query.classId || '').trim();
    const sectionId = String(req.query.section_id || req.query.sectionId || '').trim();

    if (!classId || !sectionId) {
      return res.status(400).json({ message: 'class_id and section_id query parameters are required' });
    }

    const list = await mentorSvc.getMentorPermissionsList(req.user!.schoolId!, req.user!.id, classId, sectionId);
    res.json(list);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ message: err.message || 'Unable to fetch teacher permissions', code: err.code });
  }
});

// PUT /api/teacher/mentor/permissions - Toggle assignment publishing permission for a primary subject teacher
router.put('/teacher/mentor/permissions', requireRoles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, classId, section_id, sectionId, subject_id, subjectId, target_teacher_id, targetTeacherId, is_authorized, isAuthorized } = req.body || {};

    const cId = String(class_id || classId || '').trim();
    const sId = String(section_id || sectionId || '').trim();
    const subId = String(subject_id || subjectId || '').trim();
    const tId = String(target_teacher_id || targetTeacherId || '').trim();
    const authFlag = Boolean(is_authorized !== undefined ? is_authorized : isAuthorized);

    if (!cId || !sId || !subId || !tId) {
      return res.status(400).json({ message: 'class_id, section_id, subject_id, and target_teacher_id are required' });
    }

    const result = await mentorSvc.updateSubjectTeacherPermission(
      req.user!.schoolId!,
      req.user!.id,
      cId,
      sId,
      subId,
      tId,
      authFlag
    );
    res.json(result);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ message: err.message || 'Failed to update teacher permission', code: err.code });
  }
});

// GET /api/teacher/mentor/attendance-analysis - Attendance metrics for mentored section
router.get('/teacher/mentor/attendance-analysis', requireRoles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const classId = String(req.query.class_id || req.query.classId || '').trim();
    const sectionId = String(req.query.section_id || req.query.sectionId || '').trim();
    const from = String(req.query.from || '').trim() || '2020-01-01';
    const to = String(req.query.to || '').trim() || '2099-12-31';

    if (!classId || !sectionId) {
      return res.status(400).json({ message: 'class_id and section_id query parameters are required' });
    }

    // Verify mentor status
    const isMentor = await mentorSvc.isClassMentor(req.user!.schoolId!, classId, sectionId, req.user!.id);
    if (!isMentor && req.user!.role !== 'SCHOOL_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied: User is not the Class Teacher for this section' });
    }

    const rawSession = String(
      req.query.session ||
      req.query.academicSession ||
      req.query.sessionId ||
      req.query.academic_year_id ||
      req.query.academicYearId ||
      req.headers['x-academic-year-id'] ||
      (req.headers['x-academic-session'] ? decodeURIComponent(String(req.headers['x-academic-session'])) : '') ||
      ''
    ).trim();

    let targetYearId: string | null = null;
    if (isPostgresConfigured && req.user?.schoolId) {
      try {
        if (rawSession && rawSession.toLowerCase() !== 'all' && rawSession.toLowerCase() !== 'all sessions') {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSession);
          if (isUuid) {
            targetYearId = rawSession;
          } else {
            const cleanSessionName = rawSession.replace(/\b(academic\s+)?sessions?\b/gi, '').trim();
            const ayMatch = await pool.query(
              `SELECT id, name FROM academic_years 
               WHERE school_id = $1::uuid AND (
                 LOWER(name) = LOWER($2) 
                 OR name ILIKE '%' || $3 || '%'
                 OR LOWER(code) = LOWER($2)
                 OR code ILIKE '%' || $3 || '%'
               )
               LIMIT 1`,
              [req.user.schoolId, rawSession, cleanSessionName]
            );
            if (ayMatch.rowCount && ayMatch.rowCount > 0) {
              targetYearId = ayMatch.rows[0].id;
            } else {
              targetYearId = '00000000-0000-0000-0000-000000000000';
            }
          }
        }
        if (!targetYearId && !rawSession) {
          const activeAy = await pool.query(
            `SELECT id, name FROM academic_years WHERE school_id = $1::uuid AND is_active = true LIMIT 1`,
            [req.user.schoolId]
          );
          if (activeAy.rowCount && activeAy.rowCount > 0) {
            targetYearId = activeAy.rows[0].id;
          }
        }
      } catch (err: any) {
        console.warn('[mentor attendance-analysis] Error resolving academic year:', err.message);
      }
    }

    const report = await attendanceSvc.studentAttendanceReport(req.user!.schoolId!, from, to, undefined, targetYearId || undefined);
    // Filter report by class_id, section_id, and academic session
    const filtered = report.filter((r: any) => {
      const matchClass = (r.class_id === classId || String(r.class_number) === String(classId));
      const matchSec = (r.section_id === sectionId || String(r.section_name).toLowerCase() === String(sectionId).toLowerCase());
      const matchYear = !targetYearId || !r.academic_year_id || String(r.academic_year_id) === String(targetYearId);
      return matchClass && matchSec && matchYear;
    });

    const totalStudents = filtered.length;
    const totalPresent = filtered.reduce((acc: number, r: any) => acc + (Number(r.present_days) || 0), 0);
    const totalMarked = filtered.reduce((acc: number, r: any) => acc + (Number(r.marked_days) || 0), 0);
    const overallPercentage = totalMarked > 0 ? Number(((totalPresent / totalMarked) * 100).toFixed(2)) : 0;

    res.json({
      class_id: classId,
      section_id: sectionId,
      total_students: totalStudents,
      overall_percentage: overallPercentage,
      students: filtered
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to generate attendance analysis' });
  }
});

export default router;
