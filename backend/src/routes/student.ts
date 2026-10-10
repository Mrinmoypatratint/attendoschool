import { Router, Response } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import * as svc from '../services/studentService';
import { memEntries } from './timetable';
import { isSameSchool, isTestSchool } from './auth';
import { fastCache } from '../utils/cache';
import { pool } from '../db';
import { downloadFromStorage, StorageConfigurationError } from '../utils/supabaseStorage';

const router = Router();

// Strict RBAC & Tenant context protection
router.use(requireAuth, requireRoles('STUDENT'), (req: AuthRequest, res: Response, next) => {
  if (!req.user?.schoolId) {
    return res.status(403).json({ message: 'Active institutional enrollment required' });
  }
  next();
});

// Automatic cache invalidation on student mutations
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const uid = (req as any).user?.id;
        if (uid) {
          fastCache.deletePattern(`student:${uid}`);
        }
      }
      return originalJson(body);
    };
  }
  next();
});

// GET /api/student/me - Authenticated student profile
router.get('/me', async (req: AuthRequest, res: Response) => {
  const cacheKey = `student:${req.user!.id}:me`;
  const cached = fastCache.get<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await svc.getStudentProfile(req.user!.schoolId!, req.user!.id);
    fastCache.set(cacheKey, data, 30);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load profile' });
  }
});

// GET /api/student/dashboard - Consolidated dashboard KPIs & widgets
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const cacheKey = `student:${req.user!.id}:dashboard`;
  const cached = fastCache.get<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await svc.getStudentDashboard(req.user!.schoolId!, req.user!.id);
    fastCache.set(cacheKey, data, 20);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load dashboard' });
  }
});

// GET /api/student/attendance - Student attendance logs & summary
router.get('/attendance', async (req: AuthRequest, res: Response) => {
  const from = req.query.from ? String(req.query.from) : '';
  const to = req.query.to ? String(req.query.to) : '';
  const cacheKey = `student:${req.user!.id}:attendance:${from}:${to}`;
  const cached = fastCache.get<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await svc.getStudentAttendance(req.user!.schoolId!, req.user!.id, from || undefined, to || undefined);
    fastCache.set(cacheKey, data, 20);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load attendance' });
  }
});

// GET /api/student/timetable - Routine & timetable
router.get('/timetable', async (req: AuthRequest, res: Response) => {
  const sid = req.user!.schoolId!;
  const cacheKey = `student:${req.user!.id}:timetable`;
  const cached = fastCache.get<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await svc.getStudentTimetable(sid, req.user!.id);
    if (data && data.length > 0) {
      fastCache.set(cacheKey, data, 30);
      return res.json(data);
    }
  } catch (e: any) {}


  // Fallback to in-memory timetable entries filtered by student's class/section and tenant
  const classId = (req.user as any)?.classId;
  const sectionId = (req.user as any)?.sectionId;
  const filtered = memEntries.filter(e => {
    if (e.school_id && !isSameSchool(e.school_id, sid)) return false;
    if (!e.school_id && !isTestSchool(sid)) return false;
    if (classId && sectionId) {
      return (e.class_id === classId || String(e.class_number) === String(classId)) &&
             (e.section_id === sectionId || String(e.section_name).toLowerCase() === String(sectionId).toLowerCase());
    }
    return true;
  });
  filtered.sort((a: any, b: any) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
  res.json(filtered);
});

// GET /api/student/announcements - Published announcements
router.get('/announcements', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentAnnouncements(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load announcements' });
  }
});

// GET /api/student/assignments - Homework & assignments
router.get('/assignments', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentAssignments(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load assignments' });
  }
});

// POST /api/student/assignments/:id/submit - Submit assignment text and optional attachments
router.post('/assignments/:id/submit', async (req: AuthRequest, res: Response) => {
  try {
    const { submissionText, text, attachments } = req.body || {};
    const contentText = String(submissionText !== undefined ? submissionText : (text || '')).trim();
    const data = await svc.submitStudentAssignment(
      req.user!.schoolId!,
      req.user!.id,
      String(req.params.id),
      contentText,
      attachments
    );
    res.json({ success: true, message: 'Assignment submitted successfully', data });
  } catch (e: any) {
    if (e instanceof StorageConfigurationError || e?.name === 'StorageConfigurationError' || e?.code === 'STORAGE_CONFIGURATION_MISSING') {
      return res.status(503).json({
        error: 'STORAGE_CONFIGURATION_MISSING',
        message: 'File attachment storage is currently unconfigured or unavailable. Please contact your school administrator.'
      });
    }
    res.status(400).json({ message: e.message || 'Unable to submit assignment' });
  }
});

// GET /api/student/assignments/:id/attachments/:attachmentId/preview - Preview student's own attachment
router.get('/assignments/:id/attachments/:attachmentId/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId, attachmentId } = req.params;
    const q = await pool.query(
      `SELECT att.* FROM student_assignment_attachments att
       JOIN students st ON st.id = att.student_id
       WHERE att.id = $1 AND att.assignment_id = $2 AND att.school_id = $3 AND st.user_id = $4`,
      [attachmentId, assignmentId, req.user!.schoolId!, req.user!.id]
    );

    if (q.rowCount === 0) {
      return res.status(404).json({ message: 'Attachment not found or access denied' });
    }

    const att = q.rows[0];
    const { buffer, mimeType } = await downloadFromStorage(att.storage_key);

    res.setHeader('Content-Type', att.mime_type || mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.file_name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err: any) {
    if (err instanceof StorageConfigurationError || err?.name === 'StorageConfigurationError' || err?.code === 'STORAGE_CONFIGURATION_MISSING') {
      return res.status(503).json({
        error: 'STORAGE_CONFIGURATION_MISSING',
        message: 'File attachment storage is currently unconfigured or unavailable.'
      });
    }
    res.status(500).json({ message: err.message || 'Failed to preview attachment' });
  }
});

// GET /api/student/assignments/:id/attachments/:attachmentId/download - Download student's own attachment
router.get('/assignments/:id/attachments/:attachmentId/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId, attachmentId } = req.params;
    const q = await pool.query(
      `SELECT att.* FROM student_assignment_attachments att
       JOIN students st ON st.id = att.student_id
       WHERE att.id = $1 AND att.assignment_id = $2 AND att.school_id = $3 AND st.user_id = $4`,
      [attachmentId, assignmentId, req.user!.schoolId!, req.user!.id]
    );

    if (q.rowCount === 0) {
      return res.status(404).json({ message: 'Attachment not found or access denied' });
    }

    const att = q.rows[0];
    const { buffer, mimeType } = await downloadFromStorage(att.storage_key);

    res.setHeader('Content-Type', att.mime_type || mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.file_name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  } catch (err: any) {
    if (err instanceof StorageConfigurationError || err?.name === 'StorageConfigurationError' || err?.code === 'STORAGE_CONFIGURATION_MISSING') {
      return res.status(503).json({
        error: 'STORAGE_CONFIGURATION_MISSING',
        message: 'File attachment storage is currently unconfigured or unavailable.'
      });
    }
    res.status(500).json({ message: err.message || 'Failed to download attachment' });
  }
});

// GET /api/student/exams - Exams and test results
router.get('/exams', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentExams(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load exams' });
  }
});

// GET /api/student/leave-requests - List leave requests
router.get('/leave-requests', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentLeaveRequests(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load leave requests' });
  }
});

// POST /api/student/leave-requests - Submit a leave request
router.post('/leave-requests', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, reason } = req.body || {};
    const data = await svc.createStudentLeaveRequest(req.user!.schoolId!, req.user!.id, { startDate, endDate, reason });
    res.status(201).json({ success: true, message: 'Leave request submitted', data });
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'Failed to submit leave request' });
  }
});

// PUT /api/student/change-password - Change password
router.put('/change-password', async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    const data = await svc.changeStudentPassword(req.user!.id, currentPassword, newPassword);
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'Failed to change password' });
  }
});

// PUT /api/student/photo - Upload or update student profile picture
router.put('/photo', async (req: AuthRequest, res: Response) => {
  try {
    const { photoUrl } = req.body || {};
    const data = await svc.updateStudentPhoto(req.user!.schoolId!, req.user!.id, String(photoUrl || ''));
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'Failed to update profile picture' });
  }
});

// PUT /api/student/profile - Update student profile details (gender, date of birth, etc.)
router.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const { gender, dateOfBirth, address } = req.body || {};
    if (dateOfBirth) {
      const cleanDob = String(dateOfBirth).trim();
      const match = cleanDob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (!match) {
        return res.status(400).json({ message: 'Date of birth must be strictly in DD-MM-YYYY format (e.g. 15-06-2008)' });
      }
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      if (month < 1 || month > 12) {
        return res.status(400).json({ message: 'Invalid month in Date of Birth (must be 01-12)' });
      }
      const currentYear = new Date().getFullYear();
      if (year < 1920 || year > currentYear) {
        return res.status(400).json({ message: `Invalid year in Date of Birth (must be between 1920 and ${currentYear})` });
      }
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day < 1 || day > daysInMonth) {
        return res.status(400).json({ message: `Invalid day ${day} for month ${month}` });
      }
    }
    const data = await svc.updateStudentProfile(req.user!.schoolId!, req.user!.id, { gender, dateOfBirth, address });
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'Failed to update student profile' });
  }
});

export default router;
