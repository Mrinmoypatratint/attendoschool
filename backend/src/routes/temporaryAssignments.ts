import { Router, Response } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import * as tmpSvc from '../services/temporaryAssignmentService';

const router = Router();

// All temporary‑assignment routes require authentication and admin role
router.use(requireAuth);
router.use(requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN'));

/** POST / - Create a new temporary assignment */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      class_id,
      classId,
      section_id,
      sectionId,
      teacher_id,
      teacherId,
      start_at,
      startAt,
      end_at,
      endAt,
    } = req.body || {};
    const cId = String(class_id || classId || '').trim();
    const sId = String(section_id || sectionId || '').trim();
    const tId = String(teacher_id || teacherId || '').trim();
    const start = String(start_at || startAt || '').trim();
    const end = String(end_at || endAt || '').trim();

    if (!cId || !sId || !tId || !start || !end) {
      return res
        .status(400)
        .json({ message: 'class_id, section_id, teacher_id, start_at and end_at are required' });
    }

    const data = await tmpSvc.createTemporaryAssignment({
      schoolId: req.user!.schoolId!,
      classId: cId,
      sectionId: sId,
      teacherId: tId,
      startAt: start,
      endAt: end,
    });
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    // Overlap error is conveyed via err.message already
    res.status(400).json({ message: err.message || 'Failed to create temporary assignment' });
  }
});

/** GET / - List assignments for the admin's school */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filters: any = {};
    const classId = String(req.query.class_id || req.query.classId || '').trim();
    const sectionId = String(req.query.section_id || req.query.sectionId || '').trim();
    const teacherId = String(req.query.teacher_id || req.query.teacherId || '').trim();
    const status = String(req.query.status || '').trim();
    if (classId) filters.classId = classId;
    if (sectionId) filters.sectionId = sectionId;
    if (teacherId) filters.teacherId = teacherId;
    if (status) filters.status = status as 'active' | 'future' | 'past';

    const list = await tmpSvc.listTemporaryAssignments(req.user!.schoolId!, filters);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to list temporary assignments' });
  }
});

/** PATCH /:id - Update allowed fields */
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id).trim();
    if (!assignmentId) return res.status(400).json({ message: 'Assignment id is required in URL' });
    const { start_at, startAt, end_at, endAt, teacher_id, teacherId } = req.body || {};
    const updates: any = {};
    if (start_at || startAt) updates.startAt = start_at || startAt;
    if (end_at || endAt) updates.endAt = end_at || endAt;
    if (teacher_id || teacherId) updates.teacherId = teacher_id || teacherId;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'At least one updatable field (start_at, end_at, teacher_id) required' });
    }

    const data = await tmpSvc.updateTemporaryAssignment(assignmentId, req.user!.schoolId!, updates);
    res.json({ success: true, data });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ message: err.message || 'Failed to update temporary assignment' });
  }
});

/** POST /:id/end - End assignment early */
router.post('/:id/end', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id).trim();
    if (!assignmentId) return res.status(400).json({ message: 'Assignment id is required in URL' });
    const data = await tmpSvc.endTemporaryAssignment(assignmentId, req.user!.schoolId!);
    res.json({ success: true, data });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ message: err.message || 'Failed to end temporary assignment' });
  }
});

export default router;
