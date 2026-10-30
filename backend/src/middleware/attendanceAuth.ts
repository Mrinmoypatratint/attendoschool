// attendanceAuth middleware
import { Request, Response, NextFunction } from 'express';
import { pool, isPostgresConfigured } from '../db';
import { getActiveTemporaryAssignment } from '../services/temporaryAssignmentService';
import { inMemoryClassMentors } from '../services/mentorService';
import { isSameSchool } from '../utils/tenant';

/**
 * Verify that the authenticated teacher (or admin) is allowed to take/modify
 * attendance for the given class/section.
 *
 * For POST /attendance (and POST /) the request body contains classId and sectionId.
 * For PUT /attendance/:sessionId/student/:studentId the sessionId identifies the
 * class/section – we look up the session (in-memory or DB) to obtain those IDs.
 *
 * Admin roles (SUPER_ADMIN, SCHOOL_ADMIN, ADMIN, PRINCIPAL) bypass the check.
 */
export async function requireAttendanceTeacher(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Unauthenticated' });

  // Admins can always manage attendance
  if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL'].includes(user.role)) {
    return next();
  }

  const teacherId = user.id;
  const schoolId = user.schoolId;

  // Enforce read-only post-submission for teachers on PUT/PATCH/DELETE
  if (user.role === 'TEACHER' && req.method !== 'POST') {
    return res.status(403).json({
      message: 'Attendance session is already submitted and locked for editing. Please submit an attendance correction request.',
      code: 'ATTENDANCE_SESSION_LOCKED',
    });
  }

  // Determine classId/sectionId based on route
  let classId: string | undefined;
  let sectionId: string | undefined;

  if (req.method === 'POST') {
    // body may use camelCase or snake_case
    classId = (req.body.classId || req.body.class_id) as string;
    sectionId = (req.body.sectionId || req.body.section_id) as string;
  } else if (req.method === 'PUT' && req.params.sessionId) {
    const sessionId = req.params.sessionId as string;
    // Try in-memory cache first
    const session = (global as any).memAttendanceSessions?.find(
      (s: any) => s.id === sessionId && isSameSchool(s.schoolId, schoolId),
    );
    if (session) {
      classId = session.classId || session.class_id;
      sectionId = session.sectionId || session.section_id;
    } else if (isPostgresConfigured) {
      try {
        const q = await pool.query(
          `SELECT class_id, section_id FROM attendance_sessions WHERE id = $1 AND school_id = $2`,
          [sessionId, schoolId],
        );
        if (q.rowCount) {
          classId = q.rows[0].class_id;
          sectionId = q.rows[0].section_id;
        }
      } catch (e) {
        console.warn('[attendanceAuth] Failed to fetch session:', (e as any).message);
      }
    }
  }

  if (!classId || !sectionId) {
    return res.status(400).json({ message: 'Unable to determine class/section for attendance authorization' });
  }

  // Helper to check permanent assignment (class_mentors)
  const isAssigned = async (cId: string, sId: string): Promise<boolean> => {
    if (isPostgresConfigured) {
      try {
        let resolvedClassId = cId;
        let resolvedSectionId = sId;

        const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cId);
        if (!isClassUuid) {
          const classNum = parseInt(String(cId).replace(/\D/g, ''), 10);
          if (classNum) {
            const cRes = await pool.query('SELECT id FROM classes WHERE school_id = $1 AND class_number = $2 LIMIT 1', [schoolId, classNum]);
            if (cRes.rowCount) resolvedClassId = cRes.rows[0].id;
          }
        }

        const isSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sId);
        if (!isSecUuid) {
          const sRes = await pool.query('SELECT id FROM sections WHERE school_id = $1 AND class_id = $2 AND LOWER(name) = LOWER($3) LIMIT 1', [schoolId, resolvedClassId, sId]);
          if (sRes.rowCount) resolvedSectionId = sRes.rows[0].id;
        }

        let resolvedTeacherId = teacherId;
        const isTeacherUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId);
        if (!isTeacherUuid) {
          const uRes = await pool.query('SELECT id FROM users WHERE school_id = $1 AND (email = $2 OR role = $3) LIMIT 1', [schoolId, user.email, user.role]);
          if (uRes.rowCount) resolvedTeacherId = uRes.rows[0].id;
        }

        const q = await pool.query(
          `SELECT teacher_id FROM class_mentors WHERE school_id = $1 AND class_id = $2 AND section_id = $3`,
          [schoolId, resolvedClassId, resolvedSectionId],
        );
        if (q.rowCount && (q.rows[0].teacher_id === teacherId || q.rows[0].teacher_id === resolvedTeacherId)) return true;
      } catch (e) {
        console.warn('[attendanceAuth] DB check failed, falling back:', (e as any).message);
      }
    }
    // In-memory fallback
    return inMemoryClassMentors.some(
      (m) => isSameSchool(m.school_id, schoolId) &&
        (m.class_id === cId || String((m as any).class_number) === String(cId)) &&
        (m.section_id === sId || String((m as any).section_name).toLowerCase() === String(sId).toLowerCase()) &&
        m.teacher_id === teacherId,
    );
  };

  // Helper to check temporary assignment
  const isAuthorized = async (cId: string, sId: string): Promise<boolean> => {
    // Permanent assignment first
    if (await isAssigned(cId, sId)) return true;

    // Then temporary assignment for this teacher
    try {
      let resolvedClassId = cId;
      let resolvedSectionId = sId;

      if (isPostgresConfigured) {
        const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cId);
        if (!isClassUuid) {
          const classNum = parseInt(String(cId).replace(/\D/g, ''), 10);
          if (classNum) {
            const cRes = await pool.query('SELECT id FROM classes WHERE school_id = $1 AND class_number = $2 LIMIT 1', [schoolId, classNum]);
            if (cRes.rowCount) resolvedClassId = cRes.rows[0].id;
          }
        }
        const isSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sId);
        if (!isSecUuid) {
          const sRes = await pool.query('SELECT id FROM sections WHERE school_id = $1 AND class_id = $2 AND LOWER(name) = LOWER($3) LIMIT 1', [schoolId, resolvedClassId, sId]);
          if (sRes.rowCount) resolvedSectionId = sRes.rows[0].id;
        }
      }

      let resolvedTeacherId = teacherId;
      const isTeacherUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId);
      if (!isTeacherUuid && isPostgresConfigured) {
        const uRes = await pool.query('SELECT id FROM users WHERE school_id = $1 AND (email = $2 OR role = $3) LIMIT 1', [schoolId, user.email, user.role]);
        if (uRes.rowCount) resolvedTeacherId = uRes.rows[0].id;
      }

      const tmp = await getActiveTemporaryAssignment({
        schoolId,
        classId: resolvedClassId,
        sectionId: resolvedSectionId,
        teacherId: resolvedTeacherId,
      });
      return tmp !== null;
    } catch (e) {
      console.warn('[attendanceAuth] Temp assignment check failed:', (e as any).message);
      return false;
    }
  };

  if (await isAuthorized(classId, sectionId)) {
    return next();
  }

  return res.status(403).json({ message: 'Only the assigned class teacher may take attendance' });
}
