import { Router, Response } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import * as svc from '../services/studentService';
import { memEntries } from './timetable';
import { isSameSchool, isTestSchool } from './auth';
import { fastCache } from '../utils/cache';
import { pool } from '../db';
import { downloadFromStorage, StorageConfigurationError, isInlinePreviewMime } from '../utils/firebaseStorage';

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
    const data = await svc.getStudentProfile(req.user!.schoolId!, req.user!.id, req.user?.studentId);
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
    const data = await svc.getStudentDashboard(req.user!.schoolId!, req.user!.id, req.user?.studentId);
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
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await svc.getStudentAnnouncements(req.user!.schoolId!, req.user!.id, from, to);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load announcements' });
  }
});

// POST /api/student/announcements/:id/read - Mark announcement as read
router.post('/announcements/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id);
    const userId = req.user!.id;

    // Invalidate cached dashboard so updated unread announcements reflect instantly
    svc.clearStudentDashboardCache(userId);
    fastCache.delete(`student:${userId}:dashboard`);

    const { markRead } = await import('../services/communicationService');
    const readResult = await markRead(userId, targetId);
    if (readResult) {
      return res.json({ success: true, read_at: (readResult as any).read_at || new Date().toISOString() });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetId).trim());
    if (isUuid) {
      const updated = await pool.query(
        `UPDATE announcement_recipients
         SET read_at = COALESCE(read_at, NOW()), delivery_status = 'READ'
         WHERE (id = $1 OR announcement_id = $1) AND parent_user_id = $2
         RETURNING *`,
        [targetId, userId]
      );

      if (updated.rowCount && updated.rowCount > 0) {
        return res.json({ success: true, read_at: updated.rows[0].read_at });
      }

      // Resolve the underlying announcement_id
      let resolvedAnnId: string | null = null;
      const chkAnn = await pool.query(`SELECT id FROM announcements WHERE id = $1 LIMIT 1`, [targetId]);
      if (chkAnn.rowCount && chkAnn.rowCount > 0) {
        resolvedAnnId = chkAnn.rows[0].id;
      } else {
        const chkRec = await pool.query(`SELECT announcement_id FROM announcement_recipients WHERE id = $1 LIMIT 1`, [targetId]);
        if (chkRec.rowCount && chkRec.rowCount > 0) {
          resolvedAnnId = chkRec.rows[0].announcement_id;
        }
      }

      if (resolvedAnnId) {
        const inserted = await pool.query(
          `INSERT INTO announcement_recipients (announcement_id, parent_user_id, delivery_channel, delivery_status, read_at)
           VALUES ($1, $2, 'IN_APP', 'READ', NOW())
           ON CONFLICT (announcement_id, parent_user_id, student_id, delivery_channel)
           DO UPDATE SET read_at = COALESCE(announcement_recipients.read_at, NOW()), delivery_status = 'READ'
           RETURNING *`,
          [resolvedAnnId, userId]
        );
        if (inserted.rowCount && inserted.rowCount > 0) {
          return res.json({ success: true, read_at: inserted.rows[0].read_at });
        }
      }
    }

    res.json({ success: true, read_at: new Date().toISOString() });
  } catch (_e: any) {
    res.json({ success: true, read_at: new Date().toISOString() });
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
    const { submissionText, text, attachments, removedAttachmentIds } = req.body || {};
    const contentText = String(submissionText !== undefined ? submissionText : (text || '')).trim();
    const data = await svc.submitStudentAssignment(
      req.user!.schoolId!,
      req.user!.id,
      String(req.params.id),
      contentText,
      attachments,
      removedAttachmentIds
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

// DELETE /api/student/assignments/:id/attachments/:attachmentId - Remove individual submitted attachment
router.delete('/assignments/:id/attachments/:attachmentId', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId, attachmentId } = req.params;
    const data = await svc.deleteStudentSubmissionAttachment(
      req.user!.schoolId!,
      req.user!.id,
      String(assignmentId),
      String(attachmentId)
    );
    res.json(data);
  } catch (err: any) {
    res.status(err.status || 400).json({ message: err.message || 'Failed to remove attachment' });
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

    const effectiveMime = att.mime_type || mimeType || 'application/octet-stream';
    const isInline = isInlinePreviewMime(effectiveMime);
    res.setHeader('Content-Type', effectiveMime);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.file_name)}"`);
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

// GET /api/student/assignments/:id/document/preview - Preview teacher's uploaded assignment document
router.get('/assignments/:id/document/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId } = req.params;
    const q = await pool.query(
      `SELECT a.* FROM student_assignments a
       JOIN students st ON st.school_id = a.school_id AND st.class_id = a.class_id AND (a.section_id IS NULL OR a.section_id = st.section_id)
       WHERE a.id = $1 AND a.school_id = $2 AND st.user_id = $3`,
      [assignmentId, req.user!.schoolId!, req.user!.id]
    );

    if (q.rowCount === 0) {
      return res.status(404).json({ message: 'Assignment document not found or access denied' });
    }

    const asg = q.rows[0];
    const attId = req.query.attachmentId ? String(req.query.attachmentId) : null;
    let targetDoc: any = null;
    if (attId && Array.isArray(asg.attachments)) {
      targetDoc = asg.attachments.find((a: any) => a.id === attId);
    }
    if (!targetDoc && attId) {
      try {
        const attQ = await pool.query(
          'SELECT file_name, mime_type, storage_key FROM assignment_attachments WHERE id = $1 AND assignment_id = $2',
          [attId, assignmentId]
        );
        if (attQ.rowCount && attQ.rowCount > 0) {
          targetDoc = attQ.rows[0];
        }
      } catch (_e) {}
    }
    if (!targetDoc) {
      targetDoc = {
        file_name: asg.document_name,
        mime_type: asg.document_mime,
        storage_key: asg.storage_key,
        file_data: asg.document_data
      };
    }

    if (!targetDoc.file_name && !targetDoc.file_data && !targetDoc.storage_key) {
      return res.status(404).json({ message: 'No document attached to this assignment' });
    }

    let buffer: Buffer | null = null;
    let mimeType = targetDoc.mime_type || 'application/octet-stream';
    const fileName = targetDoc.file_name || 'assignment-document.pdf';

    if (targetDoc.storage_key) {
      try {
        const dl = await downloadFromStorage(targetDoc.storage_key);
        buffer = dl.buffer;
        mimeType = dl.mimeType || mimeType;
      } catch (_e) {}
    }

    if (!buffer && targetDoc.file_data) {
      const cleanBase64 = String(targetDoc.file_data).replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    if (!buffer) {
      return res.status(404).json({ message: 'Document content is unavailable' });
    }

    const isInline = isInlinePreviewMime(mimeType);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to preview document' });
  }
});

// GET /api/student/assignments/:id/document/download - Download teacher's uploaded assignment document
router.get('/assignments/:id/document/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId } = req.params;
    const q = await pool.query(
      `SELECT a.* FROM student_assignments a
       JOIN students st ON st.school_id = a.school_id AND st.class_id = a.class_id AND (a.section_id IS NULL OR a.section_id = st.section_id)
       WHERE a.id = $1 AND a.school_id = $2 AND st.user_id = $3`,
      [assignmentId, req.user!.schoolId!, req.user!.id]
    );

    if (q.rowCount === 0) {
      return res.status(404).json({ message: 'Assignment document not found or access denied' });
    }

    const asg = q.rows[0];
    const attId = req.query.attachmentId ? String(req.query.attachmentId) : null;
    let targetDoc: any = null;
    if (attId && Array.isArray(asg.attachments)) {
      targetDoc = asg.attachments.find((a: any) => a.id === attId);
    }
    if (!targetDoc && attId) {
      try {
        const attQ = await pool.query(
          'SELECT file_name, mime_type, storage_key FROM assignment_attachments WHERE id = $1 AND assignment_id = $2',
          [attId, assignmentId]
        );
        if (attQ.rowCount && attQ.rowCount > 0) {
          targetDoc = attQ.rows[0];
        }
      } catch (_e) {}
    }
    if (!targetDoc) {
      targetDoc = {
        file_name: asg.document_name,
        mime_type: asg.document_mime,
        storage_key: asg.storage_key,
        file_data: asg.document_data
      };
    }

    if (!targetDoc.file_name && !targetDoc.file_data && !targetDoc.storage_key) {
      return res.status(404).json({ message: 'No document attached to this assignment' });
    }

    let buffer: Buffer | null = null;
    let mimeType = targetDoc.mime_type || 'application/octet-stream';
    const fileName = targetDoc.file_name || 'assignment-document.pdf';

    if (targetDoc.storage_key) {
      try {
        const dl = await downloadFromStorage(targetDoc.storage_key);
        buffer = dl.buffer;
        mimeType = dl.mimeType || mimeType;
      } catch (_e) {}
    }

    if (!buffer && targetDoc.file_data) {
      const cleanBase64 = String(targetDoc.file_data).replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    if (!buffer) {
      return res.status(404).json({ message: 'Document content is unavailable' });
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to download document' });
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
